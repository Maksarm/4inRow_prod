// создание сокета
const socket = io({
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5
});

let current_room_code = null;
let my_player_index = null;
let my_color = null;
let current_player = null;
let board_size = null;

function show_screen(screen_id) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screen_id).classList.add('active');
}

function render_empty_board() {
    const container = document.getElementById('gameBoard');
    if (!container) return;
    container.innerHTML = '';

    const rows = board_size;
    const cols = board_size + 1;

    for (let row = 0; row < rows; row++) {
        const row_div = document.createElement('div');
        row_div.className = 'board-row';
        for (let col = 0; col < cols; col++) {
            const cell = document.createElement('div');
            cell.className = 'board-cell';
            cell.dataset.col = col;
            cell.onclick = () => make_move(col);
            row_div.appendChild(cell);
        }
        container.appendChild(row_div);
    }
}

function update_board(board) {
    const container = document.getElementById('gameBoard');
    if (!container) return;

    const cells = container.querySelectorAll('.board-cell');
    const rows = board_size;
    const cols = board_size + 1;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const cell = cells[row * cols + col];
            const value = board[row][col];
            cell.classList.remove('red', 'blue');
            if (value === 'red') cell.classList.add('red');
            if (value === 'blue') cell.classList.add('blue');
        }
    }
}

function update_turn_display() {
    const turn_element = document.getElementById('turnIndicator');

    const is_my_turn = (current_player === my_player_index);
    const current_player_color = (current_player === 0) ? 'red' : 'blue';

    if (is_my_turn) {
        turn_element.innerHTML = `<span class="turn-text turn-${my_color}">ВАШ ХОД</span>`;
    } else {
        turn_element.innerHTML = `<span class="turn-text" style="color: ${current_player_color === 'red' ? '#db4437' : '#4285f4'};">ХОД ПРОТИВНИКА</span>`;
    }
}

function make_move(col) {
    if (current_player !== my_player_index) {
        return;
    }

    socket.emit('make_move', {
        room_code: current_room_code,
        col: col,
        player_index: my_player_index
    });
}


socket.on('room_created', (data) => {
    current_room_code = data.room_code;
    my_player_index = data.player_index;
    my_color = data.player_color;
    board_size = data.board_size;

    document.getElementById('roomCode').textContent = current_room_code;
    document.getElementById('gameRoomCode').textContent = current_room_code;
});

socket.on('join_error', (data) => {
    const input = document.getElementById('roomCodeInput');
    input.classList.add('shake');

    setTimeout(() => {
        input.classList.remove('shake');
    }, 600);

    show_screen('lobbyScreen');
    input.value = '';
});

document.getElementById('createRoomBtn').onclick = () => {
    const board_size_select = document.getElementById('boardSize');
    const selected_size = parseInt(board_size_select.value);

    show_screen('createScreen');
    socket.emit('create_room', { board_size: selected_size });
};

document.getElementById('createBackBtn').onclick = () => {
    show_screen('lobbyScreen');
};

document.getElementById('gameExitBtn').onclick = () => {
    localStorage.removeItem('lastRoomCode');
    localStorage.removeItem('lastRole');
    show_screen('lobbyScreen');
};

document.getElementById('copyCodeBtn').onclick = () => {
    if (current_room_code) {
        const link = window.location.origin + '/?room=' + current_room_code;
        navigator.clipboard.writeText(link);
    }
};

const copy_btn = document.getElementById('copyCodeBtn');
copy_btn.onclick = () => {
    if (current_room_code) {
        const link = window.location.origin + '/?room=' + current_room_code;
        navigator.clipboard.writeText(link);

        const original_bg = copy_btn.style.backgroundColor;
        const original_color = copy_btn.style.color;

        copy_btn.style.backgroundColor = '#ffffff';
        copy_btn.style.color = '#4285f4';
        copy_btn.textContent = 'СКОПИРОВАНО!';

        setTimeout(() => {
            copy_btn.style.backgroundColor = original_bg;
            copy_btn.style.color = original_color;
            copy_btn.textContent = 'КОПИРОВАТЬ ССЫЛКУ';
        }, 1500);
    }
};

const room_code_input = document.getElementById('roomCodeInput');
room_code_input.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 4) value = value.slice(0, 4);
    e.target.value = value;

    if (value.length === 4) {
        current_room_code = value;
        socket.emit('join_room', { room_code: value });
        document.getElementById('gameRoomCode').textContent = value;
    }
});

const url_params = new URLSearchParams(window.location.search);
const room_from_url = url_params.get('room');
if (room_from_url && room_from_url.length === 4) {
    document.getElementById('roomCodeInput').value = room_from_url;
    current_room_code = room_from_url;
    socket.emit('join_room', { room_code: room_from_url });
    show_screen('gameScreen');
    document.getElementById('gameRoomCode').textContent = room_from_url;
    window.history.replaceState({}, document.title, window.location.pathname);
}

function show_winner(winner) {
    const winner_overlay = document.getElementById('winnerOverlay');
    const winner_text = document.getElementById('winnerText');
    if (winner === 'red') {
        winner_text.innerHTML = 'ПОБЕДИЛ КРАСНЫЙ!';
        winner_text.style.color = '#db4437';
    } else if (winner === 'blue') {
        winner_text.innerHTML = 'ПОБЕДИЛ СИНИЙ!';
        winner_text.style.color = '#4285f4';
    }
    winner_overlay.style.display = 'flex';
}

function hide_winner() {
    document.getElementById('winnerOverlay').style.display = 'none';
}

document.getElementById('rematchBtn').onclick = () => {
    socket.emit('rematch', { room_code: current_room_code });
    hide_winner();
};

// выбор скинов
const red_skins = [
    { id: 'default', name: 'Классический', type: 'color', color: '#db4437' },
    { id: 'arbuz', name: 'Арбуз', type: 'image', path: '/static/images/arbuz.png' },
    { id: 'ball', name: 'Мяч', type: 'image', path: '/static/images/ball.png' },
    { id: 'sign', name: 'Знак', type: 'image', path: '/static/images/sign.png' },
    { id: 'smile', name: 'Смайл', type: 'image', path: '/static/images/smile.png' },
    { id: 'tomato', name: 'Помидор', type: 'image', path: '/static/images/tomato.png' }
];

const blue_skins = [
    { id: 'default', name: 'Классический', type: 'color', color: '#4285f4' },
    { id: 'button', name: 'Кнопка', type: 'image', path: '/static/images/button.png' },
    { id: 'planet', name: 'Планета', type: 'image', path: '/static/images/planet.png' },
    { id: 'vk', name: 'VK', type: 'image', path: '/static/images/vk.png' },
    { id: 'waterdrop', name: 'Капля', type: 'image', path: '/static/images/waterdrop.png' },
    { id: 'circle', name: 'Круг', type: 'image', path: '/static/images/circle.png' }
];

let current_board = null;
let my_red_skin = localStorage.getItem('myRedSkin') || 'default';
let my_blue_skin = localStorage.getItem('myBlueSkin') || 'default';

function init_skin_selector() {
    const container = document.getElementById('skinOptions');
    if (!container) return;

    container.innerHTML = '';

    if (my_color === 'red') {
        const title = document.createElement('div');
        title.style.cssText = 'color: #db4437; width: 100%; margin-bottom: 10px; font-size: 0.8rem; font-weight: bold;';
        title.textContent = 'ВЫБЕРИТЕ ФИШКУ (КРАСНЫЕ):';
        container.appendChild(title);

        const skins_container = document.createElement('div');
        skins_container.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap; justify-content: center;';

        red_skins.forEach(skin => {
            const option = document.createElement('div');
            option.className = 'skin-option';
            if (my_red_skin === skin.id) option.classList.add('selected');
            option.title = skin.name;

            if (skin.type === 'color') {
                option.style.backgroundColor = skin.color;
            } else {
                option.style.backgroundImage = `url('${skin.path}')`;
                option.style.backgroundSize = 'cover';
                option.style.backgroundColor = '#1a1a2e';
            }

            option.onclick = () => {
                my_red_skin = skin.id;
                localStorage.setItem('myRedSkin', skin.id);

                if (current_board) update_board_with_skins(current_board);
                socket.emit('update_skin', {
                    room_code: current_room_code,
                    color: 'red',
                    skin_id: skin.id
                });

                skins_container.querySelectorAll('.skin-option').forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
            };
            skins_container.appendChild(option);
        });
        container.appendChild(skins_container);

    } else if (my_color === 'blue') {
        const title = document.createElement('div');
        title.style.cssText = 'color: #4285f4; width: 100%; margin-bottom: 10px; font-size: 0.8rem; font-weight: bold;';
        title.textContent = 'ВЫБЕРИТЕ ФИШКУ (СИНИЕ):';
        container.appendChild(title);

        const skins_container = document.createElement('div');
        skins_container.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap; justify-content: center;';

        blue_skins.forEach(skin => {
            const option = document.createElement('div');
            option.className = 'skin-option';
            if (my_blue_skin === skin.id) option.classList.add('selected');
            option.title = skin.name;

            if (skin.type === 'color') {
                option.style.backgroundColor = skin.color;
            } else {
                option.style.backgroundImage = `url('${skin.path}')`;
                option.style.backgroundSize = 'cover';
                option.style.backgroundColor = '#1a1a2e';
            }

            option.onclick = () => {
                my_blue_skin = skin.id;
                localStorage.setItem('myBlueSkin', skin.id);

                if (current_board) update_board_with_skins(current_board);

                socket.emit('update_skin', {
                    room_code: current_room_code,
                    color: 'blue',
                    skin_id: skin.id
                });

                skins_container.querySelectorAll('.skin-option').forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
            };
            skins_container.appendChild(option);
        });
        container.appendChild(skins_container);
    }
}

function update_board_with_skins(board) {
    const container = document.getElementById('gameBoard');
    if (!container) return;

    const cells = container.querySelectorAll('.board-cell');
    const rows = board_size;
    const cols = board_size + 1;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const cell = cells[row * cols + col];
            const value = board[row][col];

            cell.innerHTML = '';
            cell.classList.remove('red', 'blue');
            cell.style.backgroundColor = '#1a1a2e';
            cell.style.backgroundImage = 'none';
            cell.style.backgroundSize = 'cover';

            if (value === 'red') {
                const skin = red_skins.find(s => s.id === my_red_skin);
                if (skin && skin.type === 'image') {
                    cell.style.backgroundImage = `url('${skin.path}')`;
                    cell.style.backgroundSize = 'cover';
                } else {
                    cell.style.backgroundColor = '#db4437';
                }
            } else if (value === 'blue') {
                const skin = blue_skins.find(s => s.id === my_blue_skin);
                if (skin && skin.type === 'image') {
                    cell.style.backgroundImage = `url('${skin.path}')`;
                    cell.style.backgroundSize = 'cover';
                } else {
                    cell.style.backgroundColor = '#4285f4';
                }
            }
        }
    }
}

socket.on('skin_updated', (data) => {
    if (data.color === 'red' && my_color === 'blue') {
        my_red_skin = data.skin_id;
        localStorage.setItem('myRedSkin', data.skin_id);
        if (current_board) update_board_with_skins(current_board);
    }
    else if (data.color === 'blue' && my_color === 'red') {
        my_blue_skin = data.skin_id;
        localStorage.setItem('myBlueSkin', data.skin_id);
        if (current_board) update_board_with_skins(current_board);
    }
});

socket.on('move_made', (data) => {
    if (data.board) {
        current_board = data.board;
        update_board_with_skins(current_board);
    }
    if (data.current_player !== undefined) current_player = data.current_player;
    update_turn_display();

    if (data.winner) {
        show_winner(data.winner);
    } else if (data.draw) {
        document.getElementById('winnerText').innerHTML = 'НИЧЬЯ!';
        document.getElementById('winnerText').style.color = 'white';
        document.getElementById('winnerOverlay').style.display = 'flex';
    }
});

socket.on('game_init', (data) => {
    my_player_index = data.player_index;
    my_color = data.player_color;
    current_player = data.current_player;
    board_size = data.board_size;

    if (my_player_index === 1) {
        localStorage.setItem('lastRoomCode', current_room_code);
        localStorage.setItem('lastRole', 'player');
    }

    render_empty_board();
    update_turn_display();
    init_skin_selector();
});

socket.on('start_game', (data) => {
    current_player = data?.current_player ?? 0;
    board_size = data?.board_size ?? 6;
    render_empty_board();
    show_screen('gameScreen');
    setTimeout(() => {
        update_turn_display();
        init_skin_selector();
    }, 100);
});

socket.on('rematch_accepted', (data) => {
    render_empty_board();
    current_player = 0;
    update_turn_display();
    hide_winner();
    current_board = null;
});

const board_size_select = document.getElementById('boardSize');
if (board_size_select) {
    board_size_select.addEventListener('change', (e) => {
        const new_size = parseInt(e.target.value);
        if (current_room_code) {
            socket.emit('update_room_size', {
                room_code: current_room_code,
                board_size: new_size
            });
        }
    });
}

socket.on('room_size_updated', (data) => {
    board_size = data.board_size;
    if (current_board) {
        render_empty_board();
    }
    update_turn_display();
});

let local_game_id = null;
let local_board = null;
let local_current_player = null;
let local_board_size = 6;
let local_red_skin = localStorage.getItem('localRedSkin') || 'default';
let local_blue_skin = localStorage.getItem('localBlueSkin') || 'default';

document.getElementById('localGameBtn').onclick = () => {
    const size_select = document.getElementById('localBoardSize');
    local_board_size = parseInt(size_select.value);
    socket.emit('create_local_room', { board_size: local_board_size });
};

socket.on('local_room_created', (data) => {
    local_game_id = data.room_code;
    local_board_size = data.board_size;
    local_current_player = 0;

    show_screen('localGameScreen');
    render_local_board();
    update_local_turn_display();
    init_local_skin_selector();

    socket.emit('init_local_game', { game_id: local_game_id, board_size: local_board_size });
});

socket.on('local_game_initialized', (data) => {
    console.log('Локальная игра инициализирована');
});

function render_local_board() {
    const container = document.getElementById('localGameBoard');
    if (!container) return;
    container.innerHTML = '';

    const rows = local_board_size;
    const cols = local_board_size + 1;

    for (let row = 0; row < rows; row++) {
        const row_div = document.createElement('div');
        row_div.className = 'board-row';
        for (let col = 0; col < cols; col++) {
            const cell = document.createElement('div');
            cell.className = 'board-cell';
            cell.dataset.col = col;
            cell.onclick = () => local_make_move(col);
            row_div.appendChild(cell);
        }
        container.appendChild(row_div);
    }
}

function update_local_board_display(board) {
    const container = document.getElementById('localGameBoard');
    if (!container) return;

    const cells = container.querySelectorAll('.board-cell');
    const rows = local_board_size;
    const cols = local_board_size + 1;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const cell = cells[row * cols + col];
            const value = board[row][col];

            cell.innerHTML = '';
            cell.classList.remove('red', 'blue');
            cell.style.backgroundColor = '#1a1a2e';
            cell.style.backgroundImage = 'none';
            cell.style.backgroundSize = 'cover';

            if (value === 'red') {
                const skin = red_skins.find(s => s.id === local_red_skin);
                if (skin && skin.type === 'image') {
                    cell.style.backgroundImage = `url('${skin.path}')`;
                    cell.style.backgroundSize = 'cover';
                } else {
                    cell.style.backgroundColor = '#db4437';
                }
            } else if (value === 'blue') {
                const skin = blue_skins.find(s => s.id === local_blue_skin);
                if (skin && skin.type === 'image') {
                    cell.style.backgroundImage = `url('${skin.path}')`;
                    cell.style.backgroundSize = 'cover';
                } else {
                    cell.style.backgroundColor = '#4285f4';
                }
            }
        }
    }
}

function update_local_turn_display() {
    const turn_element = document.getElementById('localTurnIndicator');
    if (local_current_player === 0) {
        turn_element.innerHTML = '<span class="turn-text turn-red">ХОД КРАСНОГО</span>';
    } else {
        turn_element.innerHTML = '<span class="turn-text turn-blue">ХОД СИНЕГО</span>';
    }
}

function local_make_move(col) {
    socket.emit('local_make_move', {
        game_id: local_game_id,
        col: col
    });
}

function show_local_winner(winner) {
    const overlay = document.getElementById('localWinnerOverlay');
    const winner_text = document.getElementById('localWinnerText');

    if (winner === 'red') {
        winner_text.innerHTML = 'ПОБЕДИЛ КРАСНЫЙ!';
        winner_text.style.color = '#db4437';
    } else if (winner === 'blue') {
        winner_text.innerHTML = 'ПОБЕДИЛ СИНИЙ!';
        winner_text.style.color = '#4285f4';
    }

    overlay.style.display = 'flex';
}

function hide_local_winner() {
    document.getElementById('localWinnerOverlay').style.display = 'none';
}

socket.on('local_move_made', (data) => {
    update_local_board_display(data.board);
    local_current_player = data.current_player;
    update_local_turn_display();

    if (data.winner) {
        show_local_winner(data.winner);
    } else if (data.draw) {
        document.getElementById('localWinnerText').innerHTML = '🤝 НИЧЬЯ! 🤝';
        document.getElementById('localWinnerText').style.color = 'white';
        document.getElementById('localWinnerOverlay').style.display = 'flex';
    }
});

document.getElementById('localRematchBtn').onclick = () => {
    hide_local_winner();
    socket.emit('local_reset_game', { game_id: local_game_id });
};

socket.on('local_game_reset', (data) => {
    local_board_size = data.board_size;
    local_current_player = 0;
    render_local_board();
    update_local_turn_display();
});


function init_local_skin_selector() {
    const red_container = document.getElementById('localRedSkins');
    if (red_container) {
        red_container.innerHTML = '';
        red_skins.forEach(skin => {
            const option = document.createElement('div');
            option.className = 'skin-option';
            if (local_red_skin === skin.id) option.classList.add('selected');
            option.title = skin.name;
            if (skin.type === 'color') {
                option.style.backgroundColor = skin.color;
            } else {
                option.style.backgroundImage = `url('${skin.path}')`;
                option.style.backgroundSize = 'cover';
            }
            option.onclick = () => {
                local_red_skin = skin.id;
                localStorage.setItem('localRedSkin', skin.id);
                if (local_board) update_local_board_display(local_board);
                red_container.querySelectorAll('.skin-option').forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
            };
            red_container.appendChild(option);
        });
    }

    const blue_container = document.getElementById('localBlueSkins');
    if (blue_container) {
        blue_container.innerHTML = '';
        blue_skins.forEach(skin => {
            const option = document.createElement('div');
            option.className = 'skin-option';
            if (local_blue_skin === skin.id) option.classList.add('selected');
            option.title = skin.name;
            if (skin.type === 'color') {
                option.style.backgroundColor = skin.color;
            } else {
                option.style.backgroundImage = `url('${skin.path}')`;
                option.style.backgroundSize = 'cover';
            }
            option.onclick = () => {
                local_blue_skin = skin.id;
                localStorage.setItem('localBlueSkin', skin.id);
                if (local_board) update_local_board_display(local_board);
                blue_container.querySelectorAll('.skin-option').forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
            };
            blue_container.appendChild(option);
        });
    }
}

document.getElementById('localBackBtn').onclick = () => {
    local_game_id = null;
    playersCount = 0;
    localGameActive = true;
    hide_local_winner();
    show_screen('lobbyScreen');
};

const help_btn = document.getElementById('helpBtn');
help_btn.onclick = () => {
    window.open('/static/help.pdf', '_blank');
};