import time
import random


class Room:
    """Класс для хранения данных одной комнаты"""

    def __init__(self, code, board_size=6):
        self.code = code
        self.board_size = board_size
        self.status = 'waiting'
        self.created_at = time.time()
        self.winner = None
        self.field = None
        self.current_player = 0 # 0 - хост, 1 - гость
        self.host_sid = None
        self.player_sid = None
        self.host_color = 'red'
        self.player_color = 'blue'

        self.init_game_field()

    def init_game_field(self):
        """Создать игровое поле (rows x cols)"""
        rows = self.board_size
        cols = self.board_size + 1
        self.field = [[None] * cols for _ in range(rows)]

    def get_age_seconds(self):
        """Возраст комнаты в секундах"""
        return time.time() - self.created_at

    def make_move(self, col, player_index):
        """Сделать ход со всеми проверками"""
        if self.status != 'playing':
            return False, None, "Игра не активна", None, False

        if self.current_player != player_index:
            return False, None, "Не ваш ход", None, False

        cols = self.board_size + 1
        if col < 0 or col >= cols:
            return False, None, "Неверная колонка", None, False

        row = self.drop_piece(col)
        if row is None:
            return False, None, "Колонка заполнена", None, False

        piece = 'red' if player_index == 0 else 'blue'
        self.field[row][col] = piece

        winner = self.check_win(row, col, piece)
        if winner:
            self.status = 'finished'
            self.winner = piece
            return True, row, None, piece, False

        is_draw = self.check_draw()
        if is_draw:
            self.status = 'finished'
            return True, row, None, None, True

        self.current_player = 1 - self.current_player
        return True, row, None, None, False

    def drop_piece(self, col):
        """Определяем строку для хода"""
        rows = self.board_size
        for row in range(rows - 1, -1, -1):
            if self.field[row][col] is None:
                return row
        return None

    def check_win(self, row, col, piece):
        """Проверка победы"""
        rows = self.board_size
        cols = self.board_size + 1

        count = 1
        # Влево
        for c in range(col - 1, -1, -1):
            if self.field[row][c] == piece:
                count += 1
            else:
                break
        # Вправо
        for c in range(col + 1, cols):
            if self.field[row][c] == piece:
                count += 1
            else:
                break
        if count >= 4:
            return True

        # Вертикаль
        count = 1
        for r in range(row - 1, -1, -1):
            if self.field[r][col] == piece:
                count += 1
            else:
                break
        if count >= 4:
            return True

        # Диагональ
        count = 1
        # Вверх-влево
        for r in range(row + 1, rows):
            if self.field[r][col] == piece:
                count += 1
            else:
                break
        for i in range(1, min(rows, cols)):
            if row - i >= 0 and col - i >= 0 and self.field[row - i][col - i] == piece:
                count += 1
            else:
                break
        for i in range(1, min(rows, cols)):
            if row + i < rows and col + i < cols and self.field[row + i][col + i] == piece:
                count += 1
            else:
                break
        if count >= 4:
            return True

        count = 1
        for i in range(1, min(rows, cols)):
            if row - i >= 0 and col + i < cols and self.field[row - i][col + i] == piece:
                count += 1
            else:
                break
        for i in range(1, min(rows, cols)):
            if row + i < rows and col - i >= 0 and self.field[row + i][col - i] == piece:
                count += 1
            else:
                break
        if count >= 4:
            return True

        return False

    def check_draw(self):
        """Проверка отрисовки поля"""
        rows = self.board_size
        cols = self.board_size + 1
        for row in range(rows):
            for col in range(cols):
                if self.field[row][col] is None:
                    return False
        return True


class RoomManager:
    """Менеджер для управления всеми комнатами"""
    def __init__(self):
        self.rooms = {}  # {code: Room}

    def generate_code(self):
        """Генерирует уникальный 4-значный код"""
        while True:
            code = str(random.randint(1000, 9999))
            if code not in self.rooms:
                return code

    def create_room(self, board_size=6, code=None):
        """Создает новую комнату"""
        if code is None:
            code = self.generate_code()
        room = Room(code, board_size)
        self.rooms[code] = room
        return code

    def get_room(self, code):
        """Получить комнату по коду"""
        return self.rooms.get(code)

    def delete_room(self, code):
        """Удалить комнату"""
        if code in self.rooms:
            del self.rooms[code]
            return True
        return False

    def clean_old_rooms(self, max_age_seconds=3600):
        """Удалить старые комнаты (по умолчанию 1 час)"""
        to_delete = []
        for code, room in self.rooms.items():
            if room.get_age_seconds() > max_age_seconds:
                to_delete.append(code)

        for code in to_delete:
            del self.rooms[code]

        return len(to_delete)

    def __getitem__(self, code):
        return self.rooms[code]

    def __setitem__(self, code, room):
        self.rooms[code] = room