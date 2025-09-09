const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const express = require('express');
const multer = require('multer');
const db = require('../db');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const router = express.Router();

// Compute repo root based on this file location to avoid cwd issues
const backendDir = path.join(__dirname, '..', '..');
const repoRoot = path.join(backendDir, '..');
const frontendPublicUploadsDir = path.join(repoRoot, 'frontend', 'public', 'uploads');
try { fs.mkdirSync(frontendPublicUploadsDir, { recursive: true }); } catch {}

const uploadsDirectory = process.env.UPLOAD_DIR
  ? path.isAbsolute(process.env.UPLOAD_DIR)
    ? process.env.UPLOAD_DIR
    : path.join(__dirname, '..', '..', process.env.UPLOAD_DIR)
  : path.join(__dirname, '..', '..', 'uploads');

const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, uploadsDirectory);
  },
  filename: function (_req, file, cb) {
    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
    const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
    cb(null, `${timestamp}__${safeOriginal}`);
  },
});

const upload = multer({ storage });
const publicUpload = multer({ storage: multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, frontendPublicUploadsDir);
  },
  filename: function (_req, file, cb) {
    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
    const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
    cb(null, `${timestamp}__${safeOriginal}`);
  },
})});
const memoryUpload = multer({ storage: multer.memoryStorage() });

function replacePlaceholders(template, pairs) {
  let cmd = String(template);
  pairs.forEach(([k, v]) => { cmd = cmd.split(k).join(v || ''); });
  return cmd;
}

router.post('/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided. Use form field "document".' });
    }

    const inserted = await db.query(
      `INSERT INTO documents (filename, path, mimetype, size_bytes)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [
        req.file.originalname,
        req.file.path,
        req.file.mimetype || null,
        typeof req.file.size === 'number' ? req.file.size : null,
      ]
    );

    return res.status(200).json({ id: inserted.rows[0].id });
  } catch (error) {
    console.error('Error uploading document', error);
    const message = process.env.NODE_ENV === 'development' && error && error.message ? error.message : 'Error uploading document';
    return res.status(500).json({ error: message });
  }
});

// Save directly into frontend/public/uploads and return a public URL
router.post('/upload-public', publicUpload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided. Use form field "document".' });
    }
    const filename = path.basename(req.file.filename);
    const url = `/uploads/${filename}`; // served by Vite dev and by production static hosting
    return res.status(200).json({ url, filename });
  } catch (error) {
    console.error('Error uploading to public', error);
    const message = process.env.NODE_ENV === 'development' && error && error.message ? error.message : 'Error uploading file';
    return res.status(500).json({ error: message });
  }
});

function resolvePosition(positionRaw) {
  const p = String(positionRaw || '').toLowerCase();
  return ['top-left','top-right','bottom-left','bottom-right'].includes(p) ? p : 'bottom-left';
}

async function stampSignerName(inputPath, outputPath, signerName, options = {}) {
	try {
		const bytes = fs.readFileSync(inputPath);
		const pdf = await PDFDocument.load(bytes);
		const pages = pdf.getPages();
		const font = await pdf.embedFont(StandardFonts.HelveticaBold);

		const textSize = Number(options.textSize || 14);
		const lineGap = Number(options.lineGap || 6);
		const marginX = Number(options.marginX || 16);
		const marginY = Number(options.marginY || 16);
		const position = resolvePosition(options.position || process.env.SIGN_LABEL_POSITION);
		const paddingX = Number(options.paddingX || 6);
		const paddingY = Number(options.paddingY || 6);

		const dateTimeText = options.dateTimeText || new Date().toISOString();
		const certificateText = options.certificateText || 'N/A';
		const statusText = options.statusText || 'Prepared';

		const lines = [
			`Signed by: ${String(signerName || '').trim()}`,
			`Date/Time: ${dateTimeText}`,
			`Certificate: ${certificateText}`,
			`Status: ${statusText}`,
		];

		const longestWidth = Math.max(
			...lines.map((l) => font.widthOfTextAtSize(l, textSize))
		);

		for (const page of pages) {
			const { width, height } = page.getSize();

			let startX = marginX;
			let startY = position.startsWith('top') ? (height - textSize - marginY) : marginY;
			if (position.endsWith('right')) {
				startX = Math.max(marginX, width - longestWidth - marginX);
			}

			const blockWidth = longestWidth + paddingX * 2;
			const blockHeight = lines.length * textSize + (lines.length - 1) * lineGap + paddingY * 2;
			const rectX = startX - paddingX;
			const rectY = position.startsWith('top')
				? startY - (lines.length - 1) * (textSize + lineGap) - paddingY
				: startY - paddingY;

			// Background box for readability
			page.drawRectangle({
				x: rectX,
				y: rectY,
				width: blockWidth,
				height: blockHeight,
				color: rgb(1, 1, 1),
				opacity: 0.85,
			});

			// Foreground text (all in red as requested)
			lines.forEach((text, idx) => {
				const y = position.startsWith('top')
					? startY - idx * (textSize + lineGap)
					: startY + idx * (textSize + lineGap);
				page.drawText(text, { x: startX, y: y + 2, size: textSize, font, color: rgb(1, 0, 0) });
			});
		}

		const stamped = await pdf.save();
		fs.writeFileSync(outputPath, stamped);
		return true;
	} catch (e) {
		console.error('Failed to stamp signer name', e);
		return false;
	}
}

async function stampMultipleSignerNames(inputPath, outputPath, signerNames, options = {}) {
	try {
		const names = (Array.isArray(signerNames) ? signerNames : [])
			.map((n) => String(n || '').trim())
			.filter(Boolean);
		if (names.length === 0) {
			return await stampSignerName(inputPath, outputPath, '', options);
		}

		const bytes = fs.readFileSync(inputPath);
		const pdf = await PDFDocument.load(bytes);
		const pages = pdf.getPages();
		const font = await pdf.embedFont(StandardFonts.HelveticaBold);
		const textSize = Number(options.textSize || 14);
		const lineGap = Number(options.lineGap || 6);
		const marginX = Number(options.marginX || 16);
		const marginY = Number(options.marginY || 16);
		const position = resolvePosition(options.position || process.env.SIGN_LABEL_POSITION);
		const paddingX = Number(options.paddingX || 6);
		const paddingY = Number(options.paddingY || 6);

		const dateTimeText = options.dateTimeText || new Date().toISOString();
		const certificateText = options.certificateText || 'N/A';
		const statusText = options.statusText || 'Prepared';

		const headerLines = [
			`Date/Time: ${dateTimeText}`,
			`Certificate: ${certificateText}`,
			`Status: ${statusText}`,
		];
		const nameLines = names.map((n) => `Signed by: ${n}`);
		const allLines = [...headerLines, ...nameLines];

		const longestWidth = Math.max(
			...allLines.map((l) => font.widthOfTextAtSize(l, textSize))
		);

		for (const page of pages) {
			const { width, height } = page.getSize();

			let startX = marginX;
			let startY = position.startsWith('top') ? (height - textSize - marginY) : marginY;
			if (position.endsWith('right')) {
				startX = Math.max(marginX, width - longestWidth - marginX);
			}

			const blockWidth = longestWidth + paddingX * 2;
			const blockHeight = allLines.length * textSize + (allLines.length - 1) * lineGap + paddingY * 2;
			const rectX = startX - paddingX;
			const rectY = position.startsWith('top')
				? startY - (allLines.length - 1) * (textSize + lineGap) - paddingY
				: startY - paddingY;

			// Background box for readability
			page.drawRectangle({
				x: rectX,
				y: rectY,
				width: blockWidth,
				height: blockHeight,
				color: rgb(1, 1, 1),
				opacity: 0.85,
			});

			// Foreground text (all in red as requested)
			allLines.forEach((text, idx) => {
				const y = position.startsWith('top')
					? startY - idx * (textSize + lineGap)
					: startY + idx * (textSize + lineGap);
				page.drawText(text, { x: startX, y: y + 2, size: textSize, font, color: rgb(1, 0, 0) });
			});
		}

		const stamped = await pdf.save();
		fs.writeFileSync(outputPath, stamped);
		return true;
	} catch (e) {
		console.error('Failed to stamp multiple signer names', e);
		return false;
	}
}

// sign-direct - no server storage, no DB (cert/key placeholders)
router.post('/sign-direct', memoryUpload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided. Use form field "document".' });
    }

    const originalName = req.file.originalname || 'document.pdf';
    const parsed = path.parse(originalName);
    const tempInputPath = path.join(os.tmpdir(), `${Date.now()}__${parsed.name}${parsed.ext || '.pdf'}`);
    const tempPreparedPath = path.join(os.tmpdir(), `${Date.now()}__${parsed.name}.prepared${parsed.ext || '.pdf'}`);
    const tempOutputPath = path.join(os.tmpdir(), `${Date.now()}__${parsed.name}.signed${parsed.ext || '.pdf'}`);

    fs.writeFileSync(tempInputPath, req.file.buffer);

    const signerName = (req.body && req.body.signerName) || process.env.DEFAULT_SIGNER_NAME || '';
    const position = req.body && req.body.position;
    const marginX = req.body && req.body.marginX;
    const marginY = req.body && req.body.marginY;
    const textSize = req.body && req.body.textSize;

    const templateRaw = process.env.SIGN_COMMAND_TEMPLATE || 'copy';
    const template = String(templateRaw);
    const bypass = template.trim().toLowerCase() === 'copy' || template.trim().toLowerCase() === 'noop';

    const finalize = () => {
      try { fs.unlinkSync(tempInputPath); } catch {}
      try { fs.unlinkSync(tempPreparedPath); } catch {}
      try { fs.unlinkSync(tempOutputPath); } catch {}
    };

    const sendFile = () => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${parsed.name}.signed${parsed.ext || '.pdf'}"`);
      const stream = fs.createReadStream(tempOutputPath);
      stream.on('close', finalize);
      stream.pipe(res);
    };

    // Build stamp metadata (displayed on PDF label)
    const now = new Date();
    const dateTimeText = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
    const certEnv = process.env.CERT_PATH || '';
    const certificateText = certEnv ? path.basename(certEnv) : 'N/A';
    const statusText = 'Pending signature';

    const preparedOk = await stampSignerName(
      tempInputPath,
      tempPreparedPath,
      signerName || '',
      { position, marginX, marginY, textSize, dateTimeText, certificateText, statusText }
    );
    const inputForSigning = preparedOk ? tempPreparedPath : tempInputPath;

    if (bypass) {
      fs.copyFileSync(inputForSigning, tempOutputPath);
      return sendFile();
    }

    const cert = process.env.CERT_PATH || '';
    const key = process.env.KEY_PATH || '';
    const keyPassword = process.env.KEY_PASSWORD || '';

    const command = replacePlaceholders(template, [
      ['{input}', inputForSigning],
      ['{output}', tempOutputPath],
      ['{cert}', cert],
      ['{key}', key],
      ['{keyPassword}', keyPassword],
      ['{signerName}', signerName],
      ['{reason}', ''],
      ['{location}', ''],
    ]);

    exec(command, async (err, stdout, stderr) => {
      if (err) {
        console.error('sign-direct error; returning prepared copy', { err, stdout, stderr, command });
        try {
          fs.copyFileSync(inputForSigning, tempOutputPath);
          return sendFile();
        } catch (fallbackErr) {
          console.error('sign-direct fallback failed', fallbackErr);
          finalize();
          return res.status(500).json({ error: 'Signing failed' });
        }
      } else {
        return sendFile();
      }
    });
  } catch (error) {
    console.error('Error in sign-direct', error);
    return res.status(500).json({ error: 'Error signing document' });
  }
});

// sign-direct-pfx - provide PDF + PFX + password, get signed PDF back (no DB)
router.post('/sign-direct-pfx', memoryUpload.fields([
  { name: 'document', maxCount: 1 },
  { name: 'pfx', maxCount: 1 },
]), async (req, res) => {
  try {
    const doc = req.files && req.files.document && req.files.document[0];
    const pfx = req.files && req.files.pfx && req.files.pfx[0];
    const pfxPassword = req.body && req.body.pfxPassword;
    if (!doc || !pfx || !pfxPassword) {
      return res.status(400).json({ error: 'document, pfx, and pfxPassword are required' });
    }

    const originalName = doc.originalname || 'document.pdf';
    const parsed = path.parse(originalName);
    const tempInputPath = path.join(os.tmpdir(), `${Date.now()}__${parsed.name}${parsed.ext || '.pdf'}`);
    const tempPreparedPath = path.join(os.tmpdir(), `${Date.now()}__${parsed.name}.prepared${parsed.ext || '.pdf'}`);
    const tempOutputPath = path.join(os.tmpdir(), `${Date.now()}__${parsed.name}.signed${parsed.ext || '.pdf'}`);
    const tempPfxPath = path.join(os.tmpdir(), `${Date.now()}__signer.pfx`);

    fs.writeFileSync(tempInputPath, doc.buffer);
    fs.writeFileSync(tempPfxPath, pfx.buffer);

    const signerName = (req.body && req.body.signerName) || process.env.DEFAULT_SIGNER_NAME || '';
    const reason = (req.body && req.body.reason) || process.env.DEFAULT_REASON || '';
    const location = (req.body && req.body.location) || process.env.DEFAULT_LOCATION || '';
    const textSize = (req.body && req.body.textSize);

    const templateRaw = process.env.SIGN_PFX_TEMPLATE || 'java -jar /opt/jsignpdf/jSignPdf.jar -ks "{pfx}" -kspass "{pfxPassword}" -visible -reason "{reason}" -location "{location}" -signed "{output}" "{input}"';
    const template = String(templateRaw);

    const finalize = () => {
      try { fs.unlinkSync(tempInputPath); } catch {}
      try { fs.unlinkSync(tempPreparedPath); } catch {}
      try { fs.unlinkSync(tempOutputPath); } catch {}
      try { fs.unlinkSync(tempPfxPath); } catch {}
    };

    const sendFile = () => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${parsed.name}.signed${parsed.ext || '.pdf'}"`);
      const stream = fs.createReadStream(tempOutputPath);
      stream.on('close', finalize);
      stream.pipe(res);
    };

    // Stamp human-readable metadata before signing
    const now = new Date();
    const dateTimeText = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
    const certificateText = pfx.originalname || 'PFX';
    const statusText = 'Pending signature';
    const preparedOk = await stampSignerName(
      tempInputPath,
      tempPreparedPath,
      signerName || '',
      { dateTimeText, certificateText, statusText, textSize }
    );
    const inputForSigning = preparedOk ? tempPreparedPath : tempInputPath;

    const command = replacePlaceholders(template, [
      ['{input}', inputForSigning],
      ['{output}', tempOutputPath],
      ['{pfx}', tempPfxPath],
      ['{pfxPassword}', pfxPassword],
      ['{signerName}', signerName],
      ['{reason}', reason],
      ['{location}', location],
    ]);

    exec(command, (err, stdout, stderr) => {
      if (err) {
        console.error('sign-direct-pfx error', { err, stdout, stderr, command });
        finalize();
        return res.status(500).json({ error: 'Signing failed' });
      }
      return sendFile();
    });
  } catch (error) {
    console.error('Error in sign-direct-pfx', error);
    return res.status(500).json({ error: 'Error signing document' });
  }
});

// sign-existing - append signature to already signed PDF (same as sign-direct-pfx)
router.post('/sign-existing', memoryUpload.fields([
  { name: 'document', maxCount: 1 },
  { name: 'pfx', maxCount: 1 },
]), async (req, res) => {
  // Implementation is identical to sign-direct-pfx; reuse the same handler logic for clarity
  req.url = '/api/docs/sign-direct-pfx';
  return router.handle(req, res);
});

// New: sign-direct-multi - accepts multiple signer names and stamps them stacked, then signs or returns
router.post('/sign-direct-multi', memoryUpload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided. Use form field "document".' });
    }

    const originalName = req.file.originalname || 'document.pdf';
    const parsed = path.parse(originalName);
    const tempInputPath = path.join(os.tmpdir(), `${Date.now()}__${parsed.name}${parsed.ext || '.pdf'}`);
    const tempPreparedPath = path.join(os.tmpdir(), `${Date.now()}__${parsed.name}.prepared${parsed.ext || '.pdf'}`);
    const tempOutputPath = path.join(os.tmpdir(), `${Date.now()}__${parsed.name}.signed${parsed.ext || '.pdf'}`);

    fs.writeFileSync(tempInputPath, req.file.buffer);

    let signerNamesRaw = req.body && (req.body.signerNames || req.body.signers || '');
    let signerNames = [];
    if (signerNamesRaw) {
      try {
        signerNames = JSON.parse(signerNamesRaw);
        if (!Array.isArray(signerNames)) signerNames = [];
      } catch {
        signerNames = String(signerNamesRaw).split(',');
      }
    }

    const position = req.body && req.body.position;
    const marginX = req.body && req.body.marginX;
    const marginY = req.body && req.body.marginY;
    const textSize = req.body && req.body.textSize;

    // Build stamp metadata (displayed on PDF label)
    const now = new Date();
    const dateTimeText = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
    const certEnv = process.env.CERT_PATH || '';
    const certificateText = certEnv ? path.basename(certEnv) : 'N/A';
    const statusText = 'Pending signature';

    const preparedOk = await stampMultipleSignerNames(
      tempInputPath,
      tempPreparedPath,
      signerNames,
      { position, marginX, marginY, textSize, dateTimeText, certificateText, statusText }
    );
    const inputForSigning = preparedOk ? tempPreparedPath : tempInputPath;

    const templateRaw = process.env.SIGN_COMMAND_TEMPLATE || 'copy';
    const template = String(templateRaw);
    const bypass = template.trim().toLowerCase() === 'copy' || template.trim().toLowerCase() === 'noop';

    const finalize = () => {
      try { fs.unlinkSync(tempInputPath); } catch {}
      try { fs.unlinkSync(tempPreparedPath); } catch {}
      try { fs.unlinkSync(tempOutputPath); } catch {}
    };

    const sendFile = () => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${parsed.name}.signed${parsed.ext || '.pdf'}"`);
      const stream = fs.createReadStream(tempOutputPath);
      stream.on('close', finalize);
      stream.pipe(res);
    };

    if (bypass) {
      fs.copyFileSync(inputForSigning, tempOutputPath);
      return sendFile();
    }

    const cert = process.env.CERT_PATH || '';
    const key = process.env.KEY_PATH || '';
    const keyPassword = process.env.KEY_PASSWORD || '';

    const command = replacePlaceholders(template, [
      ['{input}', inputForSigning],
      ['{output}', tempOutputPath],
      ['{cert}', cert],
      ['{key}', key],
      ['{keyPassword}', keyPassword],
      ['{signerName}', signerNames[0] || ''],
      ['{reason}', ''],
      ['{location}', ''],
    ]);

    exec(command, (err, stdout, stderr) => {
      if (err) {
        console.error('sign-direct-multi error; returning prepared copy', { err, stdout, stderr, command });
        try {
          fs.copyFileSync(inputForSigning, tempOutputPath);
          return sendFile();
        } catch (fallbackErr) {
          console.error('sign-direct-multi fallback failed', fallbackErr);
          finalize();
          return res.status(500).json({ error: 'Signing failed' });
        }
      }
      return sendFile();
    });
  } catch (error) {
    console.error('Error in sign-direct-multi', error);
    return res.status(500).json({ error: 'Error signing document' });
  }
});

router.post('/sign', async (req, res) => {
  try {
    const documentId = req.body && req.body.documentId;
    if (!documentId) {
      return res.status(400).json({ error: 'documentId is required' });
    }

    const result = await db.query('SELECT id, path FROM documents WHERE id = $1', [documentId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const inputPath = result.rows[0].path;
    if (!fs.existsSync(inputPath)) {
      return res.status(404).json({ error: 'Stored document file not found on disk' });
    }

    const outputPath = (() => {
      const parsed = path.parse(inputPath);
      const suggestedName = `${parsed.name}.signed${parsed.ext || '.pdf'}`;
      return path.join(parsed.dir, suggestedName);
    })();

    const templateRaw = process.env.SIGN_COMMAND_TEMPLATE || 'libresign --sign "{input}" --output "{output}"';
    const template = String(templateRaw);
    const bypass = template.trim().toLowerCase() === 'copy' || template.trim().toLowerCase() === 'noop';

    async function recordAndRespondOk() {
      try {
        await db.query('UPDATE documents SET signed_path = $1 WHERE id = $2', [outputPath, documentId]);
      } catch (updateError) {
        console.error('Failed to update signed_path', updateError);
      }
      return res.status(200).json({ message: 'Document signed successfully', signedPath: outputPath });
    }

    if (bypass) {
      try {
        fs.copyFileSync(inputPath, outputPath);
        console.log('Signing bypass active: copied file as signed output');
        return await recordAndRespondOk();
      } catch (copyErr) {
        console.error('Bypass copy failed', copyErr);
        return res.status(500).json({ error: 'Signing bypass failed' });
      }
    }

    const command = replacePlaceholders(template, [
      ['{input}', inputPath],
      ['{output}', outputPath],
    ]);

    exec(command, async (err, stdout, stderr) => {
      if (err) {
        console.error('Signing error, attempting fallback copy', { err, stdout, stderr });
        try {
          fs.copyFileSync(inputPath, outputPath);
          console.log('Fallback copy succeeded');
          return await recordAndRespondOk();
        } catch (fallbackErr) {
          console.error('Fallback copy failed', fallbackErr);
          return res.status(500).json({ error: 'Error signing document' });
        }
      }

      try {
        await db.query('UPDATE documents SET signed_path = $1 WHERE id = $2', [outputPath, documentId]);
      } catch (updateError) {
        console.error('Failed to update signed_path', updateError);
      }

      return res.status(200).json({ message: 'Document signed successfully', signedPath: outputPath });
    });
  } catch (error) {
    console.error('Error signing document', error);
    return res.status(500).json({ error: 'Error signing document' });
  }
});

module.exports = router;