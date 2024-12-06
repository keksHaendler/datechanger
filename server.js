const express = require('express');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const app = express();

// Middleware für statische Dateien und Body-Parsing
app.use(express.static(path.join(__dirname)));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware für Datei-Uploads
app.use(fileUpload());

// Upload-Route
app.post('/upload', (req, res) => {
    // Überprüfen, ob Dateien hochgeladen wurden
    if (!req.files || !req.files.files) {
        return res.status(400).send('No files were uploaded.');
    }

    const files = Array.isArray(req.files.files) ? req.files.files : [req.files.files];
    const newDate = new Date(req.body.date);

    // Verzeichnis für Uploads erstellen, falls nicht vorhanden
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir);
    }

    const zipPath = path.join(uploadDir, 'files.zip');
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip');

    // Archiv erstellen und Antwort senden
    output.on('close', () => {
        res.download(zipPath, 'files.zip', (err) => {
            if (err) {
                console.error('Download-Fehler:', err);
                return res.status(500).send(err);
            }
            // Temporäre Dateien entfernen
            fs.unlinkSync(zipPath);
            files.forEach(file => {
                const filePath = path.join(uploadDir, file.name);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            });
        });
    });

    archive.on('error', (err) => {
        console.error('Archiv-Fehler:', err);
        res.status(500).send({ error: err.message });
    });

    archive.pipe(output);

    let processedFiles = 0;

    // Dateien hochladen und Änderungsdatum setzen
    files.forEach(file => {
        const filePath = path.join(uploadDir, file.name);
        file.mv(filePath, (err) => {
            if (err) {
                console.error('Fehler beim Verschieben der Datei:', err);
                return res.status(500).send(err);
            }

            // Änderungsdatum der Datei setzen
            fs.utimes(filePath, new Date(), newDate, (err) => {
                if (err) {
                    console.error('Fehler beim Setzen des Änderungsdatums:', err);
                    return res.status(500).send(err);
                }
                archive.file(filePath, { name: file.name });
                processedFiles += 1;

                // Archiv finalisieren, wenn alle Dateien verarbeitet sind
                if (processedFiles === files.length) {
                    archive.finalize();
                }
            });
        });
    });
});

// Server starten
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
