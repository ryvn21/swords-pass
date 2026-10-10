Zen mode music
--------------
Zen has four stations: jazz (Tavern Jazz), lofi (Rainy Window), house (Lantern Harbour) and ambient (Still Water).
Each plays music generated live by the game. To give a station real tracks instead, put audio files
(mp3, ogg, m4a) in its folder and list them in that folder's playlist.json:

  ["first track.mp3", "second track.mp3"]

or with names:

  [{"file": "first track.mp3", "title": "First Track", "artist": "Someone"}]

Tracks listed in the playlist.json in this top folder appear as an extra station, "Your music".
An empty list means the station plays its generated music.
Only add music you have the rights to use.
