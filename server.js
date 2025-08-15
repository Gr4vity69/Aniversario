const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Permitir CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Carpeta para juegos
const GAMES_DIR = path.join(__dirname, 'games');
if (!fs.existsSync(GAMES_DIR)) fs.mkdirSync(GAMES_DIR);

// Configuración de Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const tempDir = path.join(GAMES_DIR, 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
        cb(null, tempDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// Servir archivos estáticos
app.use('/games', express.static(GAMES_DIR));
app.use(express.static(__dirname));

// API para crear juego
app.post('/api/create-game', upload.any(), (req, res) => {
    const gameId = uuidv4();
    const gameDir = path.join(GAMES_DIR, gameId);
    const tempDir = path.join(GAMES_DIR, 'temp');
    
    try {
        // Crear directorio
        fs.mkdirSync(gameDir);
        
        // Mapear archivos
        const filesMap = {};
        req.files.forEach((file) => {
            const dest = path.join(gameDir, file.filename);
            fs.renameSync(file.path, dest);
            
            const field = file.fieldname;
            if (!filesMap[field]) filesMap[field] = [];
            filesMap[field].push(`/games/${gameId}/${file.filename}`);
        });
        
        // Procesar preguntas
        const questions = JSON.parse(req.body.questions || '[]').map((q, idx) => {
            return {
                text: q.text,
                options: q.options,
                correct: q.correct,
                media: (filesMap['media-question'] && filesMap['media-question'][idx]) || null
            };
        });
        
        // Procesar mensajes intermedios
        const intermediates = JSON.parse(req.body.intermediates || '[]').map((i, idx) => {
            return {
                text: i.text,
                insertAt: parseInt(i.insertAt) || 0,
                media: (filesMap['intermediate-media'] && filesMap['intermediate-media'][idx]) || null
            };
        });
        
        // Construir configuración
        const config = {
            title: req.body['game-title'] || 'Búsqueda del Tesoro',
            bgColor: req.body['bg-color'],
            bgType: req.body['bg-type'],
            textColor: req.body['text-color'],
            btnColor: req.body['btn-color'],
            music: (filesMap['music'] && filesMap['music'][0]) || null,
            soundSelect: (filesMap['sound-select'] && filesMap['sound-select'][0]) || null,
            soundCorrect: (filesMap['sound-correct'] && filesMap['sound-correct'][0]) || null,
            soundWrong: (filesMap['sound-wrong'] && filesMap['sound-wrong'][0]) || null,
            bgFile: (filesMap['bg-file'] && filesMap['bg-file'][0]) || null,
            questions,
            intermediates,
            maxAttempts: req.body['max-attempts'] || 3,
            particleColor: req.body['particle-color'] || '#ffd700',
            
            // Feedback
            correctMessage: req.body['msg-correct'] || '¡Correcto!',
            correctMedia: (filesMap['media-correct'] && filesMap['media-correct'][0]) || null,
            correctAudio: (filesMap['audio-correct'] && filesMap['audio-correct'][0]) || null,
            correctAnim: req.body['anim-correct'] || 'confetti',
            correctEmojis: req.body['emoji-correct'] || '🎉,🌟,💫',
            
            wrongMessage: req.body['msg-wrong'] || '¡Incorrecto! Intenta de nuevo',
            wrongMedia: (filesMap['media-wrong'] && filesMap['media-wrong'][0]) || null,
            wrongAudio: (filesMap['audio-wrong'] && filesMap['audio-wrong'][0]) || null,
            wrongAnim: req.body['anim-wrong'] || 'shake',
            wrongEmojis: req.body['emoji-wrong'] || '💥,😢,❌',
            
            winMessage: req.body['msg-win'] || '¡Felicidades! Has ganado',
            winMedia: (filesMap['media-win'] && filesMap['media-win'][0]) || null,
            winAudio: (filesMap['audio-win'] && filesMap['audio-win'][0]) || null,
            winAnim: req.body['anim-win'] || 'confetti',
            winEmojis: req.body['emoji-win'] || '🏆,🎊,🥳',
            
            loseMessage: req.body['msg-lose'] || '¡Has perdido! Intenta de nuevo',
            loseMedia: (filesMap['media-lose'] && filesMap['media-lose'][0]) || null,
            loseAudio: (filesMap['audio-lose'] && filesMap['audio-lose'][0]) || null,
            loseAnim: req.body['anim-lose'] || 'shake',
            loseEmojis: req.body['emoji-lose'] || '💔,😢,☠️'
        };
        
        // Guardar configuración
        fs.writeFileSync(path.join(gameDir, 'config.json'), JSON.stringify(config, null, 2));
        
        // Copiar plantilla
        const templatePath = path.join(__dirname, 'game_template.html');
        const destPath = path.join(gameDir, 'index.html');
        fs.copyFileSync(templatePath, destPath);
        
        // Devolver URL
        res.json({ url: `/games/${gameId}/index.html` });
        
    } catch (err) {
        console.error('Error creating game:', err);
        res.status(500).json({ error: 'Error al crear el juego: ' + err.message });
        
        // Limpiar en caso de error
        if (fs.existsSync(gameDir)) {
            fs.rmSync(gameDir, { recursive: true, force: true });
        }
    } finally {
        // Limpiar directorio temporal
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    }
});

// Obtener configuración del juego
app.get('/api/game/:id/config', (req, res) => {
    const gameDir = path.join(GAMES_DIR, req.params.id);
    const configPath = path.join(gameDir, 'config.json');
    
    if (fs.existsSync(configPath)) {
        res.sendFile(configPath);
    } else {
        res.status(404).json({ error: 'Configuración no encontrada' });
    }
});

// Manejo de errores
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});