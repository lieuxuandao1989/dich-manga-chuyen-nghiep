// Helper to create high quality canvas sample manga pages for testing
export function generateSampleMangaPage(pageNumber: number): Promise<{ blob: Blob; filename: string }> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 1200;
    const ctx = canvas.getContext('2d')!;

    // Page 1: FULL COLOR COVER PAGE (Page 1 of CBZ)
    if (pageNumber === 1) {
      // Vibrant cover background gradient (sunset / fantasy sky)
      const grad = ctx.createLinearGradient(0, 0, 800, 1200);
      grad.addColorStop(0, '#1e1b4b'); // Deep indigo
      grad.addColorStop(0.35, '#4338ca'); // Royal blue
      grad.addColorStop(0.65, '#e11d48'); // Crimson red
      grad.addColorStop(0.9, '#f59e0b'); // Golden amber
      grad.addColorStop(1, '#fef08a'); // Warm sun yellow
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 800, 1200);

      // Sun halo graphic
      ctx.fillStyle = 'rgba(254, 240, 138, 0.4)';
      ctx.beginPath();
      ctx.arc(400, 500, 260, 0, Math.PI * 2);
      ctx.fill();

      // Golden rays
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 16; i++) {
        const ang = (i * Math.PI * 2) / 16;
        ctx.beginPath();
        ctx.moveTo(400, 500);
        ctx.lineTo(400 + Math.cos(ang) * 380, 500 + Math.sin(ang) * 380);
        ctx.stroke();
      }

      // Title Banner
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(40, 80, 720, 200);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 4;
      ctx.strokeRect(40, 80, 720, 200);

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 54px Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('HERO OF THE SUN', 400, 160);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('VOLUME 1 • OFFICIAL COLOR COVER', 400, 210);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'italic 18px sans-serif';
      ctx.fillText('Original Manga by Studio Nova', 400, 250);

      // Center silhouette hero
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(400, 560, 90, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(320, 650, 160, 360);

      // Color Badge Banner at bottom
      ctx.fillStyle = 'rgba(220, 38, 38, 0.9)';
      ctx.fillRect(60, 1050, 680, 70);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('★ COLOR SPECIAL EDITION - NOT FOR TRANSLATION ★', 400, 1092);

      // Page Number indicator
      ctx.fillStyle = '#ffffff';
      ctx.font = '16px monospace';
      ctx.fillText('- Page 1 (Color Cover) -', 400, 1170);

      canvas.toBlob((blob) => {
        if (blob) resolve({ blob, filename: `page_001_cover.png` });
      }, 'image/png');
      return;
    }

    // Page 2: FULL COLOR CHARACTER INTRO / PINUP (Page 2 of CBZ)
    if (pageNumber === 2) {
      const grad = ctx.createLinearGradient(0, 0, 800, 1200);
      grad.addColorStop(0, '#065f46'); // Emerald dark
      grad.addColorStop(0.5, '#047857'); // Emerald green
      grad.addColorStop(1, '#022c22');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 800, 1200);

      // Title
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('MAIN CHARACTERS & GUILD', 400, 100);

      // 3 Colorful Character Cards
      const cards = [
        { name: 'KAI (Solar Knight)', color: '#ef4444', desc: 'Weapon: Dawn Blade', y: 160 },
        { name: 'AELIA (Moon Mage)', color: '#3b82f6', desc: 'Magic: Lunar Barrier', y: 480 },
        { name: 'REN (Shadow Rogue)', color: '#8b5cf6', desc: 'Skill: Phantom Step', y: 800 },
      ];

      cards.forEach((card) => {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
        ctx.fillRect(60, card.y, 680, 260);
        ctx.strokeStyle = card.color;
        ctx.lineWidth = 3;
        ctx.strokeRect(60, card.y, 680, 260);

        // Character color avatar circle
        ctx.fillStyle = card.color;
        ctx.beginPath();
        ctx.arc(160, card.y + 130, 70, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.font = 'bold 28px sans-serif';
        ctx.fillText(card.name, 260, card.y + 90);

        ctx.fillStyle = '#cbd5e1';
        ctx.font = '20px sans-serif';
        ctx.fillText(card.desc, 260, card.y + 140);
        ctx.fillText('Role: Legendary Vanguard', 260, card.y + 180);
      });

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.font = '16px monospace';
      ctx.fillText('- Page 2 (Color Pinup) -', 400, 1170);

      canvas.toBlob((blob) => {
        if (blob) resolve({ blob, filename: `page_002_pinup.png` });
      }, 'image/png');
      return;
    }

    // Page 3: B&W TABLE OF CONTENTS & CREDITS (Page 3 of CBZ)
    if (pageNumber === 3) {
      ctx.fillStyle = '#faf8f5';
      ctx.fillRect(0, 0, 800, 1200);

      ctx.strokeStyle = '#222';
      ctx.lineWidth = 4;
      ctx.strokeRect(40, 40, 720, 1120);

      ctx.fillStyle = '#111';
      ctx.font = 'bold 44px Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TABLE OF CONTENTS', 400, 140);

      ctx.fillStyle = '#444';
      ctx.font = '18px sans-serif';
      ctx.fillText('Manga CBZ Archive Index • First 4 Pages', 400, 180);

      // Line divider
      ctx.beginPath();
      ctx.moveTo(80, 220);
      ctx.lineTo(720, 220);
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 2;
      ctx.stroke();

      const chapters = [
        { ch: 'Page 01 - 02', title: 'Color Cover & Character Roster' },
        { ch: 'Page 03 - 04', title: 'Table of Contents & World Lore' },
        { ch: 'Page 05', title: 'Chapter 1: The Dark Forest Begins' },
        { ch: 'Page 06', title: 'Chapter 1: The Secret Confrontation' },
        { ch: 'Page 07', title: 'Chapter 1: Solar Flare Strike' },
      ];

      chapters.forEach((c, idx) => {
        const y = 300 + idx * 110;
        ctx.fillStyle = '#111';
        ctx.font = 'bold 22px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(c.ch, 100, y);

        ctx.font = '20px sans-serif';
        ctx.fillText(c.title, 100, y + 35);
      });

      ctx.fillStyle = '#666';
      ctx.textAlign = 'center';
      ctx.font = '16px monospace';
      ctx.fillText('- Page 3 (Table of Contents) -', 400, 1140);

      canvas.toBlob((blob) => {
        if (blob) resolve({ blob, filename: `page_003_toc.png` });
      }, 'image/png');
      return;
    }

    // Page 4: B&W WORLD LORE & PROLOGUE (Page 4 of CBZ)
    if (pageNumber === 4) {
      ctx.fillStyle = '#f8f8f8';
      ctx.fillRect(0, 0, 800, 1200);

      ctx.strokeStyle = '#222';
      ctx.lineWidth = 3;
      ctx.strokeRect(40, 40, 720, 1120);

      ctx.fillStyle = '#111';
      ctx.font = 'bold 36px Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PROLOGUE: THE REALM OF SOLARIA', 400, 130);

      ctx.fillStyle = '#222';
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'left';

      const loreParagraphs = [
        'A thousand years ago, the Kingdom of Solaria was protected',
        'by the Eternal Beacon. When the dark shadows gathered,',
        'only one chosen warrior could wield the Solar Blade.',
        '',
        'This page is part of the front introductory matter.',
        'Typically in Manga CBZ files, the first 4 pages are skipped',
        'to preserve original credit banners and cover artwork!',
      ];

      loreParagraphs.forEach((p, idx) => {
        ctx.fillText(p, 80, 240 + idx * 36);
      });

      // Illustration box (monochrome)
      ctx.strokeStyle = '#444';
      ctx.strokeRect(80, 560, 640, 480);
      ctx.fillStyle = '#eee';
      ctx.fillRect(85, 565, 630, 470);

      ctx.fillStyle = '#333';
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('[ B&W WORLD MAP & HISTORICAL PROLOGUE ]', 400, 800);

      ctx.fillStyle = '#666';
      ctx.font = '16px monospace';
      ctx.fillText('- Page 4 (Prologue) -', 400, 1140);

      canvas.toBlob((blob) => {
        if (blob) resolve({ blob, filename: `page_004_prologue.png` });
      }, 'image/png');
      return;
    }

    // Pages 5, 6, 7: Black & White Manga Story Pages (Pages eligible for Translation!)
    // Background - Manga page (clean monochrome manga paper)
    ctx.fillStyle = '#faf8f5';
    ctx.fillRect(0, 0, 800, 1200);

    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;

    if (pageNumber === 5) {
      // PAGE 5: Action Story Page (Eligible: B&W and > Page 4)
      ctx.strokeRect(40, 40, 720, 320);
      ctx.fillStyle = '#111';
      ctx.fillRect(45, 45, 710, 310);

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 36px Impact, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('CHAPTER 1: THE BEGINNING', 70, 120);
      ctx.font = 'italic 20px sans-serif';
      ctx.fillText('Story Panel 1: Deep in the Black Forest', 70, 160);

      ctx.strokeRect(40, 380, 340, 760);
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(210, 600, 80, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(150, 680, 120, 300);

      // Speech bubble 1 (Top Panel)
      drawSpeechBubble(ctx, 480, 200, 220, 100, [
        'Hey! Did you hear about',
        'the mysterious warrior?',
      ]);

      // Speech bubble 2 (Bottom Left Panel)
      drawSpeechBubble(ctx, 80, 420, 240, 110, [
        'I will become the strongest',
        'guardian in this realm!',
      ]);

      // Speech bubble 3 (Bottom Left Panel)
      drawSpeechBubble(ctx, 100, 800, 220, 100, [
        'No matter what happens,',
        "I won't give up!",
      ]);

      // Panel 3: Bottom Right
      ctx.strokeRect(400, 380, 360, 760);
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(405, 385, 350, 750);

      // Speech bubble 4 (Bottom Right Panel)
      drawSpeechBubble(ctx, 440, 450, 280, 120, [
        "Wait! Don't go into",
        'that dark forest alone!',
      ]);

      // Speech bubble 5 (Bottom Right Panel)
      drawSpeechBubble(ctx, 460, 750, 250, 110, [
        "It's too dangerous!",
        'Let me come with you!',
      ]);
    } else if (pageNumber === 6) {
      // PAGE 6: Dialogue & Tension Panel Layout (Eligible: B&W and > Page 4)
      ctx.strokeRect(40, 40, 720, 340);
      ctx.fillStyle = '#e5e5e5';
      ctx.fillRect(45, 45, 710, 330);

      drawSpeechBubble(ctx, 80, 80, 260, 110, [
        'Why are you always',
        'running away from me?',
      ]);

      drawSpeechBubble(ctx, 420, 180, 280, 110, [
        'Because I have a secret',
        'I can never tell anyone...',
      ]);

      ctx.strokeRect(40, 400, 720, 340);
      drawSpeechBubble(ctx, 100, 430, 250, 110, [
        'What kind of secret?',
        'We are team members!',
      ]);

      drawSpeechBubble(ctx, 400, 520, 280, 120, [
        'If you knew the truth,',
        'you would despise me!',
      ]);

      ctx.strokeRect(40, 760, 720, 380);
      ctx.fillStyle = '#111';
      ctx.fillRect(45, 765, 710, 370);

      ctx.fillStyle = '#fff';
      ctx.font = 'bold italic 48px Impact, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('RUMBLE!!', 100, 880);

      drawSpeechBubble(ctx, 380, 880, 320, 120, [
        'Look out! The enemy is',
        'approaching from above!',
      ]);
    } else {
      // PAGE 7: Climax Scene (Eligible: B&W and > Page 4)
      ctx.strokeRect(40, 40, 720, 1100);
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(45, 45, 710, 1090);

      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1;
      for (let i = 0; i < 36; i++) {
        const angle = (i * Math.PI * 2) / 36;
        ctx.beginPath();
        ctx.moveTo(400, 600);
        ctx.lineTo(400 + Math.cos(angle) * 600, 600 + Math.sin(angle) * 600);
        ctx.stroke();
      }

      ctx.fillStyle = '#fff';
      ctx.font = 'bold italic 64px Impact, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('BOOM!!', 260, 300);

      drawSpeechBubble(ctx, 80, 450, 300, 130, [
        'This is my ultimate attack!',
        'Solar Flare Strike!!',
      ]);

      drawSpeechBubble(ctx, 420, 700, 300, 120, [
        'Impossible... How could',
        'you possess such power?!',
      ]);

      drawSpeechBubble(ctx, 120, 920, 280, 110, [
        'To be continued in',
        'the next chapter...',
      ]);
    }

    // Page Number
    ctx.fillStyle = '#666';
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`- ${pageNumber} -`, 400, 1180);

    canvas.toBlob((blob) => {
      if (blob) {
        resolve({ blob, filename: `page_${String(pageNumber).padStart(3, '0')}.png` });
      }
    }, 'image/png');
  });
}

function drawSpeechBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  lines: string[]
) {
  ctx.save();
  // White bubble with black outline
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 20);
  ctx.fill();
  ctx.stroke();

  // Pointer tail
  ctx.beginPath();
  ctx.moveTo(x + w / 2 - 10, y + h);
  ctx.lineTo(x + w / 2, y + h + 15);
  ctx.lineTo(x + w / 2 + 10, y + h);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.stroke();

  // Text inside bubble
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 15px "Comic Sans MS", cursive, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const lineHeight = 20;
  const startY = y + h / 2 - ((lines.length - 1) * lineHeight) / 2;

  lines.forEach((line, idx) => {
    ctx.fillText(line, x + w / 2, startY + idx * lineHeight);
  });

  ctx.restore();
}
