class PlayerDataAggregator:
    def __init__(self):
        self.players = {}
        self.processed_images = []

    def add_image_data(self, filename, players_data):
        self.processed_images.append({
            'filename': filename,
            'players': players_data,
            'player_count': len(players_data)
        })

        for player in players_data:
            nickname = player['nickname']
            exp = player['exp']
            time = player['time']

            if nickname in self.players:
                self.players[nickname]['totalEXP'] += exp
                self.players[nickname]['appearances'] += 1
                self.players[nickname]['images'].append(filename)

                # update bestTime
                if time != 'TIME OVER':
                    current_best = self.players[nickname]['bestTime']
                    if current_best == 'TIME OVER' or time < current_best:
                        self.players[nickname]['bestTime'] = time
                else:
                    self.players[nickname]['timeOverCount'] += 1
            else:
                self.players[nickname] = {
                    'nickname': nickname,
                    'totalEXP': exp,
                    'appearances': 1,
                    'bestTime': time,
                    'timeOverCount': 1 if time == 'TIME OVER' else 0,
                    'images': [filename]
                }

    def get_aggregated_data(self):
        players_list = list(self.players.values())
        total_exp = sum(p['totalEXP'] for p in players_list)
        return {
            'players': players_list,
            'statistics': {
                'unique_players': len(players_list),
                'total_images': len(self.processed_images),
                'total_exp': total_exp,
                'avg_exp': total_exp // len(players_list) if players_list else 0
            },
            'processed_images': self.processed_images
        }
