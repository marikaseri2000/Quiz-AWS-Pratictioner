# ☁️ AWS Cloud Practitioner Quiz App

Questa è una web app "Single Page Application" (SPA) completa per esercitarsi con i quiz AWS Cloud Practitioner.
Include:
- 6 Moduli di quiz
- Timer di 90 minuti
- Feedback immediato con spiegazioni
- **Banca Errori Persistente**: Salva le domande sbagliate per ripassarle dopo
- Animazioni di feedback (Ema Contento / Ema Deluso)

## 🚀 Come avviare l'app

Poiché l'app carica file JSON esterni, i browser moderni bloccano le richieste se apri direttamente il file `index.html` (protocollo `file://`) per motivi di sicurezza (CORS).

Devi usare un **server web locale**. Ecco come fare:

### Opzione 1: Python (Consigliato)
Se hai Python installato (è già presente nella maggior parte dei sistemi Windows/Mac/Linux):

1. Apri il terminale (Prompt dei comandi o PowerShell) in questa cartella.
2. Esegui il comando:
   ```bash
   python -m http.server 8000
   ```
3. Apri il browser e vai su: [http://localhost:8000](http://localhost:8000)

### Opzione 2: Estensione VS Code "Live Server"
Se usi VS Code:
1. Installa l'estensione **Live Server**.
2. Fai clic destro su `index.html` e scegli **"Open with Live Server"**.

## 📂 Struttura File
- `index.html`: Struttura della pagina.
- `styles.css`: Stili e animazioni.
- `app.js`: Logica completa (Quiz, Timer, Errori, ecc.).
- `modules.js`: Configurazione dei moduli disponibili.
- `assets/`: Immagini per il feedback.
- `*.json`: File dei quiz.

## ✨ Funzionalità
- **Moduli**: Clicca su un modulo per avviare la simulazione (90 min).
- **Feedback**: Conferma la risposta per vedere subito se è corretta.
- **Errori**: Le risposte errate vengono salvate automaticamente. Dalla Home puoi vedere quante ne hai e avviare una sessione di ripasso solo con quelle ("Riprova Solo Errori").

Buono studio! 🚀
