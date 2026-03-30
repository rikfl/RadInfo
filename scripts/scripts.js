let socket = null;
let songHistoryCache = [];

const radioApp = document.getElementById('radioApp');
const stationImage = document.getElementById('stationImage');
const stationProgram = document.getElementById('stationProgram');
const songTitle = document.getElementById('songTitle');
const songArtist = document.getElementById('songArtist');
const songArt = document.getElementById('songArt');
const songArtBackground = document.getElementById('songArtBackground');
const songHistory = document.getElementById('songHistory');
const songsLiked = document.getElementById('songsLiked');

const buttonBack = document.getElementById("buttonBack");
const buttonLike = document.getElementById('buttonLike');
const buttonSettings = document.getElementById('buttonSettings');
const checkboxStayAwake = document.getElementById('checkboxStayAwake');

let tmpPlayingInfo = {
    station: {
        name:'',
        program:'',
        url:'',
        image:''
    },
    song: {
        title:'',
        artist:'',
        art:''
    }
}
const emptyPlayingInfo = {station: {name:'',program:'',url:'',image:''},song: {title:'',artist:'',art:''}}

const stations = {
    npo2: { name: 'NPO Radio 2', url: 'https://icecast.omroep.nl/radio2-sb-mp3', image: 'images/npo2.png' },
    npo6: { name: 'NPO Soul & Jazz', url: 'http://icecast.npocloud.nl/radio6-sb-mp3', image: 'images/npo6.png' },
    sublime: { name: 'Sublime', url: 'https://22333.live.streamtheworld.com/SUBLIME.mp3', image: 'images/sublime.png' },
    skyradio: { name: 'Sky Radio', url: 'https://25273.live.streamtheworld.com/SKYRADIO.mp3', image: 'images/skyradio.png' },
    100: { name: '100% NL', url: 'https://stream.100p.nl/100pctnl.mp3', image: 'images/100.png' }
};

switchView('splashScreen');
createWebSocketConnection('wss://backend.radiolise.com/api/data-service');
loadLikedSongs();

function switchView(view) {    
    if (radioApp) {
        const sections = radioApp.querySelectorAll('section');
        sections.forEach(section => {
            section.style.display = 'none';
        });
        document.getElementById(view).style.display = 'flex';
    } else {
        console.error(`No container found with ID: ${containerId}`);
    }
};

function setRadioStation(station) {
    tmpPlayingInfo.station = { ...stations[station], program:stations[station].name };
    msgSubscribe();
    updateElements();
    switchView('playingScreen');
    requestWakeLock();
}


function createWebSocketConnection(url) {
    if (socket) {
        console.log(currentTime(),'WebSocket is already open.');
        return;
    }
    socket = new WebSocket(url,'v1');

    socket.onopen = function(event) {
        console.log(currentTime(),'OnOpen WebSocket is open');
        radioApp.classList.remove("loading");
        radioApp.classList.add("WebSocket-open");

    };

    socket.onmessage = function(message) {
        console.log(currentTime(), '(1) OnMessage recieved',JSON.parse(message.data));
        retrieveSongInfo(JSON.parse(message.data).data.title);

    };

    socket.onerror = function(error) {
        console.error(currentTime(), 'OnError Socket encountered error:', error, 'Closing socket');
        socket.close();
    };

    socket.onclose = function(event) {
        socket = null;
        radioApp.classList.add("loading");
        radioApp.classList.remove("WebSocket-open");
        console.log(currentTime(), 'OnClose WebSocket is closed, reconnecting in 5 seconds.');
        setTimeout(() => {
            createWebSocketConnection(url);
        }, 5000);
    };
}

async function retrieveSongInfo(info) {
    console.log(currentTime(),'(2.1) retrieveSongInfo: ',info);
    const delimiter = ' - ';
    
    if (!info || !info.includes(delimiter)) {
        console.error('Invalid song info format:', info);
        return;
    }

    const parts = info.split(delimiter);

    if (parts.length === 2) {
        tmpPlayingInfo.song.artist = parts[0];
        tmpPlayingInfo.song.title = parts[1];
        try {
            console.log('Fetching album art...');
            const albumArtUrl = await getAlbumArt(tmpPlayingInfo.song.title, tmpPlayingInfo.song.artist);
            console.log(currentTime(),'(2.2) update albumUrl: ',albumArtUrl);
            tmpPlayingInfo.song.art = albumArtUrl || '';  // In case null is returned
        } catch (error) {
            console.error('Error fetching album art:', error);
        }
    } else {
        console.log(currentTime(),'(2.3) update program');
        tmpPlayingInfo.song.artist = '';
        tmpPlayingInfo.song.title = '';
        tmpPlayingInfo.song.art = tmpPlayingInfo.station.image;
        tmpPlayingInfo.station.program = info;
    }
    updateElements();
}

async function getAlbumArt(song, artist) {
    console.log(currentTime(),'(2a) getAlbumArt');
    const url = `https://wandering-paper-0ea4.polished-recipe-54f2.workers.dev/?song=${encodeURIComponent(song)}&artist=${encodeURIComponent(artist)}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    console.log('data:',data);
    if (data.track.album) {
      // Retrieve the album art URL (image size can be changed by changing 'size')
      const totalImages = data.track.album.image.length;
      const imageUrl = data.track.album.image[totalImages-1]['#text'];
      return imageUrl; // Returns the album art URL
    } else {
      console.log('Album not found!');
      return '';
    }
  } catch (error) {
    console.error('Error fetching album info:', error);
    return null;
  }
}

function resetTmpPlayingInfo() {
    tmpPlayingInfo.song.artist = '';
    tmpPlayingInfo.song.title = '';
    tmpPlayingInfo.song.art = 'images/fallback.png';
    tmpPlayingInfo.station.name = '';
    tmpPlayingInfo.station.program = '';
    updateElements();
}

function updateElements() {
    console.log(currentTime(),'(3) updateElements');
    // Update station program if it has changed
    if (tmpPlayingInfo.station.program !== stationProgram.textContent) {
        stationProgram.textContent = tmpPlayingInfo.station.program || `${tmpPlayingInfo.station.name}`;
    }

    // Update song title and artist
    if (songTitle.textContent !== tmpPlayingInfo.song.title) {
        songTitle.textContent = tmpPlayingInfo.song.title || '';
    }
    if (songArtist.textContent !== tmpPlayingInfo.song.artist) {
        songArtist.textContent = tmpPlayingInfo.song.artist || '';
    }

    // Update song art
    if (!songArt.src.endsWith(tmpPlayingInfo.song.art)) {
        songArt.src = tmpPlayingInfo.song.art || tmpPlayingInfo.station.image;
        songArtBackground.src = tmpPlayingInfo.song.art || tmpPlayingInfo.station.image;
    }

    // Update song history only if new
    const songEntry = `${tmpPlayingInfo.song.title} - ${tmpPlayingInfo.song.artist}`;
    if (!songHistoryCache.includes(songEntry)) {
        songHistoryCache.push(songEntry);
        songHistory.innerHTML = '<li>'+currentTime()+': '+songEntry+' ('+tmpPlayingInfo.station.program+')</li>'+songHistory.innerHTML;
    }
    buttonLike.classList.remove('liked');
    console.log(currentTime(),'updateElements:', tmpPlayingInfo);
}

// Get the current timestamp in milliseconds
function currentTime(){
    const timestamp = Date.now();

    // Create a Date object with the current timestamp
    const date = new Date(timestamp);

    // Extract hours, minutes, and seconds
    let hours = date.getHours();
    let minutes = date.getMinutes();
    let seconds = date.getSeconds();

    // Ensure two-digit formatting (e.g., '09' instead of '9')
    hours = hours < 10 ? '0' + hours : hours;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    seconds = seconds < 10 ? '0' + seconds : seconds;

    return hours+':'+minutes+':'+seconds;
}

function msgSubscribe() {
// Create the JSON data you want to send
    let message = {
        action:'subscribe',
        data: {
            url:tmpPlayingInfo.station.url
        }
    }
    console.log('message:',message);
    sendMessageToServer(message);
}

function msgUnSubscribe() {
// Create the JSON data you want to send
    let message = {
        action:'unsubscribe'
    }
    console.log('message:',message);
    sendMessageToServer(message);

}

function sendMessageToServer(message) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
        console.log(currentTime(),'Message sent');
    } else {
        console.log(currentTime(),'WebSocket is not open. Unable to send message.');
    }
}

let wakeLock = null;
async function requestWakeLock() {
try {
    wakeLock = await navigator.wakeLock.request('screen');
    checkboxStayAwake.checked = true;
   
    wakeLock.addEventListener('release', () => {
        checkboxStayAwake.checked = false;
    });
} catch (err) {
    console.log(err.message);
    checkboxStayAwake.checked = false;
}
}

// EVENT LISTENERS
checkboxStayAwake.addEventListener('click', () => {
if (!wakeLock) {
    requestWakeLock();
}
});

buttonBack.addEventListener("click", () => {
    switchView('splashScreen');
    resetTmpPlayingInfo();
    msgUnSubscribe();
});

buttonSettings.addEventListener("click", () => {
    openModal('settingsScreen');
    switchTab('tab1');
});

buttonLike.addEventListener('click', () => {
    buttonLike.classList.toggle('liked');
    if (buttonLike.classList.contains('liked')) {
        saveLikedSong(tmpPlayingInfo.song.title+' - '+tmpPlayingInfo.song.artist);
    } else {
        removeLikedSong(tmpPlayingInfo.song.title+' - '+tmpPlayingInfo.song.artist);
    }
});

// LIKED SONGS
function loadLikedSongs() {
    const songs = JSON.parse(localStorage.getItem('likedSongs')) || [];
    songsLiked.innerHTML = songs.length
        ? songs.map(item => `<li>${item}</li>`).join('')
        : '<li>No liked songs yet.</li>';
}

function saveLikedSong(song) {
    const songs = JSON.parse(localStorage.getItem('likedSongs')) || [];
    if (!songs.includes(song)) {
        songs.unshift(song); // Add new song to the top
        localStorage.setItem('likedSongs', JSON.stringify(songs));
        loadLikedSongs();
    }
}

function removeLikedSong(song) {
    let songs = JSON.parse(localStorage.getItem('likedSongs')) || [];
    songs = songs.filter(s => s !== song); // Remove the song
    localStorage.setItem('likedSongs', JSON.stringify(songs));
    loadLikedSongs();
}

function openModal(view) {
    document.getElementById(view).style.display = 'flex';
}

function closeModal(view) {
    document.getElementById(view).style.display = 'none';
}

function switchTab(tabId) {
    const tabs = document.querySelectorAll('.tab');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => tab.classList.remove('active'));
    contents.forEach(content => content.classList.remove('active'));

    const selectedTab = document.querySelector(`.tab[onclick="switchTab('${tabId}')"]`);
    if (!selectedTab.classList.contains('disabled')) {
        selectedTab.classList.add('active');
        document.getElementById(tabId).classList.add('active');
    }
}