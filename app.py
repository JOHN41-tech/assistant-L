from flask import Flask, render_template, request, jsonify, session, make_response
import os
from dotenv import load_dotenv
from backend.core.session import LearningSession
from backend.api.perplexity import PerplexityClient
import backend.utils.database as db
from backend.utils.quiz_generator import QuizGenerator
import json

load_dotenv()

app = Flask(__name__, 
            template_folder='frontend/templates',
            static_folder='frontend/static')
app.secret_key = os.getenv('SECRET_KEY', os.urandom(24))

# Store sessions in memory
sessions = {}
quiz_gen = QuizGenerator()
perplexity_client = PerplexityClient()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/start-topic', methods=['POST'])
def start_topic():
    data = request.json
    topic = data.get('topic')
    persona = data.get('persona', 'General')
    difficulty = data.get('difficulty', 'Intermediate')
    
    if not topic:
        return jsonify({'error': 'Topic is required'}), 400
    
    session_id = request.cookies.get('session_id', os.urandom(16).hex())
    learning_session = LearningSession(persona=persona, difficulty=difficulty)
    
    try:
        roadmap = learning_session.start_new_topic(topic)
        sessions[session_id] = learning_session
        
        steps = [
            {
                'number': step['number'],
                'title': step['title'],
                'details': step['details']
            }
            for step in roadmap.steps
        ]
        
        # Save to database
        roadmap_data = {'topic': topic, 'steps': steps, 'persona': persona, 'difficulty': difficulty}
        topic_id = db.save_topic(topic, roadmap_data, len(steps))
        
        response = jsonify({
            'success': True,
            'topic': topic,
            'topic_id': topic_id,
            'steps': steps,
            'currentStep': 0
        })
        response.set_cookie('session_id', session_id)
        response.set_cookie('topic_id', str(topic_id))
        return response
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/get-guide', methods=['POST'])
def get_guide():
    session_id = request.cookies.get('session_id')
    
    if not session_id or session_id not in sessions:
        return jsonify({'error': 'No active session'}), 400
    
    learning_session = sessions[session_id]
    
    try:
        guide = learning_session.get_detailed_guide_for_step()
        return jsonify({
            'success': True,
            'guide': guide
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/next-step', methods=['POST'])
def next_step():
    session_id = request.cookies.get('session_id')
    topic_id = request.cookies.get('topic_id')
    
    if not session_id or session_id not in sessions:
        return jsonify({'error': 'No active session'}), 400
    
    learning_session = sessions[session_id]
    step = learning_session.next_step()
    
    # Update progress in database
    if topic_id:
        db.update_topic_progress(int(topic_id), learning_session.current_step_index)
    
    if step:
        return jsonify({
            'success': True,
            'step': {
                'number': step['number'],
                'title': step['title'],
                'details': step['details']
            },
            'currentStepIndex': learning_session.current_step_index
        })
    else:
        return jsonify({
            'success': True,
            'completed': True,
            'message': 'You have completed the roadmap!'
        })

@app.route('/api/chat', methods=['POST'])
def chat():
    """Handle chat messages with persona awareness"""
    data = request.json
    message = data.get('message')
    topic_id = request.cookies.get('topic_id')
    session_id = request.cookies.get('session_id')
    
    if not message:
        return jsonify({'error': 'Message is required'}), 400
    
    if not session_id or session_id not in sessions:
        return jsonify({'error': 'No active session'}), 400
    
    learning_session = sessions[session_id]
    current_step = learning_session.get_current_step()
    
    try:
        persona_styles = {
            "General": "helpful and clear",
            "Scientist": "academic, precise, and highly technical",
            "ELI5": "extremely simple, using analogies that a 5-year-old would understand",
            "Socratic": "inquisitive, answering with questions that guide the user to discover the answer themselves"
        }
        style = persona_styles.get(learning_session.persona, "helpful")
        
        # Build context-aware prompt
        context = f"""You are a {learning_session.persona} learning assistant. Your teaching style is {style}.
The user is currently learning about:
Topic: {learning_session.roadmap.topic}
Difficulty: {learning_session.difficulty}
Current Step: {current_step['title']}

User question: {message}

Provide a clear, helpful answer in your assigned style ({style}) that relates to their current learning step."""
        
        messages = [{"role": "user", "content": context}]
        response = perplexity_client.chat_completion(messages)
        ai_response = response['choices'][0]['message']['content']
        
        # Save to database
        if topic_id:
            db.save_chat_message(int(topic_id), learning_session.current_step_index, 'user', message)
            db.save_chat_message(int(topic_id), learning_session.current_step_index, 'assistant', ai_response)
        
        return jsonify({
            'success': True,
            'response': ai_response
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/generate-quiz', methods=['POST'])
def generate_quiz():
    """Generate a quiz for the current step"""
    session_id = request.cookies.get('session_id')
    
    if not session_id or session_id not in sessions:
        return jsonify({'error': 'No active session'}), 400
    
    learning_session = sessions[session_id]
    current_step = learning_session.get_current_step()
    
    try:
        step_details = '\n'.join(current_step['details']) if current_step['details'] else current_step['title']
        questions = quiz_gen.generate_quiz(
            learning_session.roadmap.topic,
            current_step['title'],
            step_details
        )
        
        return jsonify({
            'success': True,
            'questions': questions
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/submit-quiz', methods=['POST'])
def submit_quiz():
    """Submit quiz answers and get score"""
    data = request.json
    answers = data.get('answers', {})
    questions = data.get('questions', [])
    topic_id = request.cookies.get('topic_id')
    session_id = request.cookies.get('session_id')
    
    if not session_id or session_id not in sessions:
        return jsonify({'error': 'No active session'}), 400
    
    learning_session = sessions[session_id]
    
    # Calculate score
    correct = 0
    results = []
    
    for i, question in enumerate(questions):
        user_answer = answers.get(str(i))
        is_correct = quiz_gen.check_answer(question, user_answer) if user_answer else False
        
        if is_correct:
            correct += 1
        
        results.append({
            'question_number': i + 1,
            'correct': is_correct,
            'user_answer': user_answer,
            'correct_answer': question['correct']
        })
    
    # Save to database
    if topic_id:
        db.save_quiz_result(int(topic_id), learning_session.current_step_index, correct, len(questions))
    
    return jsonify({
        'success': True,
        'score': correct,
        'total': len(questions),
        'percentage': round((correct / len(questions)) * 100) if questions else 0,
        'results': results
    })

@app.route('/api/save-note', methods=['POST'])
def save_note():
    """Save a note for the current step"""
    data = request.json
    content = data.get('content')
    topic_id = request.cookies.get('topic_id')
    session_id = request.cookies.get('session_id')
    
    if not content:
        return jsonify({'error': 'Content is required'}), 400
    
    if not session_id or session_id not in sessions:
        return jsonify({'error': 'No active session'}), 400
    
    learning_session = sessions[session_id]
    
    if topic_id:
        db.save_note(int(topic_id), learning_session.current_step_index, content)
    
    return jsonify({'success': True})

@app.route('/api/get-note', methods=['GET'])
def get_note():
    """Get note for current step"""
    topic_id = request.cookies.get('topic_id')
    session_id = request.cookies.get('session_id')
    
    if not session_id or session_id not in sessions:
        return jsonify({'error': 'No active session'}), 400
    
    learning_session = sessions[session_id]
    
    if topic_id:
        note = db.get_note(int(topic_id), learning_session.current_step_index)
        return jsonify({'success': True, 'note': note})
    
    return jsonify({'success': True, 'note': None})

@app.route('/api/topics', methods=['GET'])
def get_topics():
    """Get all topics"""
    topics = db.get_all_topics()
    return jsonify({'success': True, 'topics': topics})

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get learning statistics"""
    topics = db.get_all_topics()
    total_topics = len(topics)
    completed_topics = len([t for t in topics if t['completed']])
    
    # Calculate total steps across all topics
    total_steps = sum([t['total_steps'] for t in topics])
    current_steps = sum([t['current_step'] + 1 for t in topics]) # +1 because current_step is 0-indexed
    
    return jsonify({
        'success': True,
        'totalTopics': total_topics,
        'completedTopics': completed_topics,
        'progress': round((current_steps / total_steps) * 100) if total_steps > 0 else 0
    })

@app.route('/api/export', methods=['GET'])
def export_handbook():
    """Export the current learning session as a Markdown handbook"""
    topic_id = request.cookies.get('topic_id')
    session_id = request.cookies.get('session_id')
    
    if not session_id or session_id not in sessions:
        return "No active session found.", 400
    
    learning_session = sessions[session_id]
    topic_data = db.get_topic(int(topic_id))
    
    if not topic_data:
        return "Topic not found.", 404
    
    md_content = f"# Learning Handbook: {topic_data['name']}\n"
    md_content += f"**Persona:** {learning_session.persona} | **Difficulty:** {learning_session.difficulty}\n\n"
    md_content += "## Roadmap\n"
    for i, step in enumerate(topic_data['roadmap_data']['steps']):
        md_content += f"### Step {i+1}: {step['title']}\n"
        for detail in step['details']:
            md_content += f"- {detail}\n"
        
        # Add Note
        note = db.get_note(int(topic_id), i)
        if note:
            md_content += f"\n#### My Notes\n> {note}\n"
        
        # Add Chat History
        chat_history = db.get_chat_history(int(topic_id), i)
        if chat_history:
            md_content += f"\n#### Chat History\n"
            for msg in chat_history:
                md_content += f"**{msg['role'].capitalize()}:** {msg['message']}\n\n"
        
        md_content += "\n---\n"
    
    response = make_response(md_content)
    response.headers["Content-Disposition"] = f"attachment; filename={topic_data['name'].replace(' ', '_')}_Handook.md"
    response.headers["Content-Type"] = "text/markdown"
    return response

@app.route('/api/chat-history', methods=['GET'])
def get_chat_history():
    """Get chat history for current step"""
    topic_id = request.cookies.get('topic_id')
    session_id = request.cookies.get('session_id')
    
    if not session_id or session_id not in sessions:
        return jsonify({'error': 'No active session'}), 400
    
    learning_session = sessions[session_id]
    
    if topic_id:
        history = db.get_chat_history(int(topic_id), learning_session.current_step_index)
        return jsonify({'success': True, 'history': history})
    
    return jsonify({'success': True, 'history': []})

@app.route('/api/get-resources', methods=['POST'])
def get_resources():
    """Fetch related learning resources for the current step"""
    data = request.json
    topic = data.get('topic')
    step_title = data.get('step')
    
    if not topic or not step_title:
        return jsonify({'error': 'Topic and step title are required'}), 400
    
    try:
        prompt = f"""Find 3 highly relevant learning resources (articles, videos, or courses) for someone learning about "{step_title}" in the context of "{topic}".
        Return only a JSON list of objects, each with 'title', 'type' (Article, Video, or Course), and 'url'.
        No other text."""
        
        messages = [{"role": "user", "content": prompt}]
        response = perplexity_client.chat_completion(messages)
        ai_response = response['choices'][0]['message']['content']
        
        # Extract JSON from response if there's any markdown wrapping
        if "```json" in ai_response:
            ai_response = ai_response.split("```json")[1].split("```")[0].strip()
        elif "```" in ai_response:
            ai_response = ai_response.split("```")[1].split("```")[0].strip()
            
        resources = json.loads(ai_response)
        
        return jsonify({
            'success': True,
            'resources': resources
        })
    except Exception as e:
        # Fallback to a simple search URL if AI fails
        return jsonify({
            'success': True,
            'resources': [
                {'title': f'Search for {step_title}', 'type': 'Article', 'url': f'https://www.google.com/search?q={topic}+{step_title}'}
            ]
        })

@app.route('/api/clear-chat', methods=['POST'])
def clear_chat():
    """Clear chat history for current step"""
    topic_id = request.cookies.get('topic_id')
    session_id = request.cookies.get('session_id')
    
    if not session_id or session_id not in sessions:
        return jsonify({'error': 'No active session'}), 400
    
    learning_session = sessions[session_id]
    
    if topic_id:
        db.clear_chat_history(int(topic_id), learning_session.current_step_index)
        return jsonify({'success': True})
    
    return jsonify({'error': 'No topic selected'}), 400

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    host = os.getenv('HOST', '0.0.0.0')
    debug = os.getenv('FLASK_ENV', 'development') == 'development'
    app.run(host=host, port=port, debug=debug)
