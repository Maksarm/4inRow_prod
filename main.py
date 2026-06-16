from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit
from room_logics import RoomManager
import time, threading, os

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'secret')
rmg = RoomManager()
socketio = SocketIO(app,
    cors_allowed_origins="*",
    async_mode='eventlet'
)


def clean_rooms_periodically():
    while True:
        time.sleep(3600)
        rmg.clean_old_rooms()


threading.Thread(target=clean_rooms_periodically, daemon=True).start()


@app.route('/')
def index():
    return render_template('index.html')


@socketio.on('create_room')
def handle_create_room(data):
    """Создание новой комнаты (хост)"""
    board_size = data.get('board_size', 6)

    code = rmg.create_room(board_size=board_size)
    room = rmg.get_room(code)
    room.host_sid = request.sid
    room.status = 'waiting'
    room.current_player = 0
    room.board_size = board_size

    emit('room_created', {
        'room_code': code,
        'player_index': 0,
        'player_color': 'red',
        'board_size': room.board_size
    })


@socketio.on('update_room_size')
def handle_update_room_size(data):
    room_code = data.get('room_code')
    new_size = data.get('board_size')

    if room_code not in rmg.rooms:
        return

    room = rmg[room_code]

    room.board_size = new_size

    room.init_game_field()
    room.current_player = 0
    room.status = 'waiting' if room.player_sid is None else 'playing'

    socketio.emit('room_size_updated', {
        'board_size': new_size
    }, room=room_code)


@socketio.on('join_room')
def handle_join_room(data):
    room_code = data.get('room_code')

    if room_code not in rmg.rooms:
        emit('join_error', {'error': 'Комната не найдена'}, to=request.sid)
        return

    room = rmg[room_code]
    room.status = 'playing'
    room.current_player = 0

    emit('game_init', {
        'player_index': 1,
        'player_color': 'blue',
        'current_player': room.current_player,
        'board_size': room.board_size
    }, to=request.sid)
    socketio.emit('start_game', {
        'room_code': room_code,
        'current_player': room.current_player,
        'board_size': room.board_size
    }, to=request.sid)

    if room.host_sid:
        socketio.emit('start_game', {
            'room_code': room_code,
            'current_player': room.current_player,
            'board_size': room.board_size
        }, to=room.host_sid)


@socketio.on('make_move')
def handle_make_move(data):
    """Сделан ход"""
    room_code = data.get('room_code')
    col = data.get('col')
    player_index = data.get('player_index')

    room = rmg[room_code]
    success, row, error, winner, is_draw = room.make_move(col, player_index)

    socketio.emit('move_made', {
        'board': room.field,
        'current_player': room.current_player,
        'winner': winner,
        'draw': is_draw
    }, to=room.host_sid)
    socketio.emit('move_made', {
        'board': room.field,
        'current_player': room.current_player,
        'winner': winner,
        'draw': is_draw
    }, to=room.player_sid)


@socketio.on('rematch')
def handle_rematch(data):
    """Реванш"""
    room_code = data.get('room_code')

    if room_code not in rmg.rooms:
        return

    room = rmg[room_code]

    for row in range(room.board_size):
        for col in range(room.board_size + 1):
            room.field[row][col] = None

    room.status = 'playing'
    room.current_player = 0
    room.winner = None

    socketio.emit('rematch_accepted', {
        'board_size': room.board_size
    }, to=room.player_sid)
    socketio.emit('rematch_accepted', {
        'board_size': room.board_size
    }, to=room.host_sid)


@socketio.on('update_skin')
def handle_update_skin(data):
    """Обновление фишки"""
    room_code = data.get('room_code')
    color = data.get('color')
    skin_id = data.get('skin_id')

    room = rmg.get_room(room_code)
    if not room:
        return

    socketio.emit('skin_updated', {
        'color': color,
        'skin_id': skin_id
    }, to=room.host_sid)
    socketio.emit('skin_updated', {
        'color': color,
        'skin_id': skin_id
    }, to=room.player_sid)


@socketio.on('create_local_room')
def handle_create_local_room(data):
    """Создание локальной комнаты"""
    board_size = data.get('board_size', 6)

    code = rmg.create_room(board_size=board_size)
    room = rmg.get_room(code)
    room.host_sid = request.sid
    room.status = 'waiting'
    room.current_player = 0
    room.is_local = True

    emit('local_room_created', {
        'room_code': code,
        'board_size': board_size
    }, to=request.sid)


@socketio.on('register_local_player')
def handle_register_local_player(data):
    """Регистрация локального игрока"""
    room_code = data.get('room_code')
    player_index = data.get('player_index')

    room = rmg[room_code]

    room.host_sid = request.sid
    room.player_sid = request.sid
    room.status = 'playing'
    room.current_player = 0

    emit('local_player_registered', {'player_index': player_index}, to=request.sid)


@socketio.on('start_local_game')
def handle_start_local_game(data):
    """Старт локлаьной игры"""
    room_code = data.get('room_code')

    room = rmg[room_code]

    emit('local_game_started', {
        'board_size': room.board_size
    }, to=request.sid)


@socketio.on('local_make_move')
def handle_local_make_move(data):
    """Локальный ход"""
    game_id = data.get('game_id')
    col = data.get('col')

    room = rmg[game_id]

    room.status = 'playing'
    success, row, error, winner, is_draw = room.make_move(col, room.current_player)

    emit('local_move_made', {
        'board': room.field,
        'current_player': room.current_player,
        'winner': winner,
        'draw': is_draw
    }, to=request.sid)


@socketio.on('local_reset_game')
def handle_local_reset_game(data):
    """Рестарт локальной игры"""
    room_code = data.get('game_id')

    if room_code not in rmg.rooms:
        return

    room = rmg[room_code]

    rows = room.board_size
    cols = room.board_size + 1
    room.field = [[None] * cols for _ in range(rows)]
    room.status = 'playing'
    room.current_player = 0
    room.winner = None

    emit('local_game_reset', {
        'board_size': room.board_size
    }, to=request.sid)


PRODUCTION = 1

host = '0.0.0.0'
if PRODUCTION == 0:
    host = '127.0.0.1'
if __name__ == '__main__':
    socketio.run(app, host=host, debug=True, port=5000, allow_unsafe_werkzeug=True, use_reloader=False)