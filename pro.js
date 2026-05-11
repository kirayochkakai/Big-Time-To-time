document.addEventListener("DOMContentLoaded", () => {
    createScheduleTable();
    loadData();
    renderScheduleRecords();
    startNotificationChecker();
});

let notificationChecker = null;

function createScheduleTable() {
    const scheduleBody = document.getElementById("scheduleBody");
    const rows = [];

    for (let day = 1; day <= 7; day++) {
        const timeCells = [];
        const taskCells = [];

        for (let slot = 1; slot <= 6; slot++) {
            timeCells.push(`<td><input type="time" name="time${day}_${slot}" title="time${day}_${slot}"></td>`);
            taskCells.push(`<td><input type="text" name="task${day}_${slot}" placeholder="mission"></td>`);
        }

        rows.push(`
            <tr>
                <td rowspan="2"><input type="text" name="day${day}" placeholder="day${day}"></td>
                ${timeCells.join("")}
            </tr>
            <tr>
                ${taskCells.join("")}
            </tr>
        `);
    }

    scheduleBody.innerHTML = rows.join("");
}

function getFormData() {
    const form = document.getElementById("myForm");
    return Array.from(new FormData(form).entries());
}

function saveData() {
    localStorage.setItem("scheduleData", JSON.stringify(getFormData()));
    localStorage.setItem("scheduleNotificationsEnabled", String("Notification" in window && Notification.permission === "granted"));
    saveScheduleRecord();
    renderScheduleRecords();
    alert("Emploi du temps enregistre.");
}

function loadData() {
    const savedData = JSON.parse(localStorage.getItem("scheduleData") || "[]");

    savedData.forEach(([name, value]) => {
        const input = document.querySelector(`[name="${name}"]`);

        if (input) {
            input.value = value;
        }
    });
}

function resetForm() {
    document.getElementById("myForm").reset();
    localStorage.removeItem("scheduleData");
    localStorage.removeItem("scheduleNotificationsEnabled");
    localStorage.removeItem("sentScheduleNotifications");
}

function saveScheduleRecord() {
    const records = getScheduleRecords();
    const record = {
        id: Date.now(),
        createdAt: new Date().toLocaleString("fr-FR"),
        rows: getScheduleRows()
    };

    records.unshift(record);
    localStorage.setItem("scheduleRecords", JSON.stringify(records));
}

function getScheduleRecords() {
    return JSON.parse(localStorage.getItem("scheduleRecords") || "[]");
}

function renderScheduleRecords() {
    const recordsContainer = document.getElementById("scheduleRecords");

    if (!recordsContainer) {
        return;
    }

    const records = getScheduleRecords();

    if (!records.length) {
        recordsContainer.innerHTML = `<p class="empty-records">Aucun emploi du temps enregistre pour le moment.</p>`;
        return;
    }

    recordsContainer.innerHTML = records.map((record, index) => createRecordHtml(record, index)).join("");
}

function createRecordHtml(record, index) {
    const rows = record.rows.map((row, rowIndex) => {
        const slots = row.slots.map((slot) => {
            const value = [slot.time, slot.task].filter(Boolean).join(" - ") || "-";
            return `<td>${escapeHtml(value)}</td>`;
        }).join("");

        return `
            <tr>
                <td>${escapeHtml(row.day || `Jour ${rowIndex + 1}`)}</td>
                ${slots}
            </tr>
        `;
    }).join("");

    return `
        <article class="record-item">
            <h3>Enregistrement ${index + 1}</h3>
            <p>${escapeHtml(record.createdAt)}</p>
            <div class="record-table-wrap">
                <table class="record-table">
                    <thead>
                        <tr>
                            <th>Jour</th>
                            <th>Heure 1</th>
                            <th>Heure 2</th>
                            <th>Heure 3</th>
                            <th>Heure 4</th>
                            <th>Heure 5</th>
                            <th>Heure 6</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </article>
    `;
}

function clearScheduleRecords() {
    localStorage.removeItem("scheduleRecords");
    renderScheduleRecords();
}

async function enableNotifications() {
    if (!("Notification" in window)) {
        alert("Votre navigateur ne supporte pas les notifications.");
        return;
    }

    if (Notification.permission === "denied") {
        alert("Les notifications sont bloquees. Autorisez-les dans les parametres du navigateur pour ce site.");
        return;
    }

    let permission = Notification.permission;

    if (permission === "default") {
        permission = await Notification.requestPermission();
    }

    if (permission === "granted") {
        localStorage.setItem("scheduleNotificationsEnabled", "true");
        startNotificationChecker();

        new Notification("Notifications activees", {
            body: "Les rappels de votre emploi du temps sont maintenant actives."
        });

        alert("Notifications activees. Gardez cette page ouverte pour recevoir les rappels.");
    } else {
        localStorage.setItem("scheduleNotificationsEnabled", "false");
        alert("Notifications refusees. Vous pouvez les autoriser dans les parametres du navigateur.");
    }
}

function startNotificationChecker() {
    if (notificationChecker) {
        clearInterval(notificationChecker);
    }

    notificationChecker = setInterval(checkScheduleNotifications, 30000);
    checkScheduleNotifications();
}

function checkScheduleNotifications() {
    if (!("Notification" in window)) {
        return;
    }

    if (Notification.permission !== "granted") {
        return;
    }

    if (localStorage.getItem("scheduleNotificationsEnabled") !== "true") {
        return;
    }

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const currentDate = now.toISOString().slice(0, 10);
    const sentNotifications = JSON.parse(localStorage.getItem("sentScheduleNotifications") || "{}");

    getScheduleRows().forEach((row, rowIndex) => {
        row.slots.forEach((slot, slotIndex) => {
            if (!slot.time || slot.time !== currentTime) {
                return;
            }

            const notificationKey = `${currentDate}-${rowIndex + 1}-${slotIndex + 1}-${slot.time}`;

            if (sentNotifications[notificationKey]) {
                return;
            }

            const dayName = row.day || `Jour ${rowIndex + 1}`;
            const taskName = slot.task || "Mission a faire";

            new Notification("Rappel emploi du temps", {
                body: `${dayName} - ${slot.time}: ${taskName}`
            });

            sentNotifications[notificationKey] = true;
        });
    });

    localStorage.setItem("sentScheduleNotifications", JSON.stringify(sentNotifications));
}

function downloadSchedule() {
    const pdfContent = createSchedulePdf();
    const blob = new Blob([pdfContent], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "emploi-du-temps.pdf";
    link.click();
    URL.revokeObjectURL(url);
}

function createSchedulePdf() {
    const pageWidth = 842;
    const pageHeight = 595;
    const margin = 36;
    const tableWidth = pageWidth - margin * 2;
    const firstColumnWidth = 95;
    const slotColumnWidth = (tableWidth - firstColumnWidth) / 6;
    const headerHeight = 34;
    const rowHeight = 58;
    const tableTop = 500;
    const rows = getScheduleRows();
    const commands = [];

    commands.push("0.97 0.98 1 rg 0 0 842 595 re f");
    drawText(commands, "Emploi du temps", margin, 542, 22, "0.08 0.13 0.23");
    drawText(commands, "Planning hebdomadaire", margin, 520, 11, "0.39 0.45 0.55");

    drawCell(commands, margin, tableTop, firstColumnWidth, headerHeight, "Jour", true);

    for (let slot = 1; slot <= 6; slot++) {
        const x = margin + firstColumnWidth + (slot - 1) * slotColumnWidth;
        drawCell(commands, x, tableTop, slotColumnWidth, headerHeight, `Heure ${slot}`, true);
    }

    rows.forEach((row, rowIndex) => {
        const y = tableTop - headerHeight - rowIndex * rowHeight;

        drawCell(commands, margin, y, firstColumnWidth, rowHeight, row.day || `Jour ${rowIndex + 1}`, false);

        row.slots.forEach((slot, slotIndex) => {
            const x = margin + firstColumnWidth + slotIndex * slotColumnWidth;
            const value = [slot.time, slot.task].filter(Boolean).join(" - ");
            drawCell(commands, x, y, slotColumnWidth, rowHeight, value, false);
        });
    });

    return buildPdf(commands.join("\n"), pageWidth, pageHeight);
}

function getScheduleRows() {
    const rows = [];

    for (let day = 1; day <= 7; day++) {
        const slots = [];

        for (let slot = 1; slot <= 6; slot++) {
            slots.push({
                time: getInputValue(`time${day}_${slot}`),
                task: getInputValue(`task${day}_${slot}`)
            });
        }

        rows.push({
            day: getInputValue(`day${day}`),
            slots
        });
    }

    return rows;
}

function drawCell(commands, x, yTop, width, height, text, isHeader) {
    const y = yTop - height;
    const fillColor = isHeader ? "0.10 0.23 0.48" : "1 1 1";
    const textColor = isHeader ? "1 1 1" : "0.10 0.13 0.20";
    const fontSize = isHeader ? 10 : 8;
    const maxChars = Math.max(8, Math.floor(width / 5.2));
    const lines = wrapText(cleanPdfText(text), maxChars).slice(0, 4);

    commands.push(`${fillColor} rg ${formatNumber(x)} ${formatNumber(y)} ${formatNumber(width)} ${formatNumber(height)} re f`);
    commands.push("0.80 0.84 0.90 RG 0.8 w");
    commands.push(`${formatNumber(x)} ${formatNumber(y)} ${formatNumber(width)} ${formatNumber(height)} re S`);

    lines.forEach((line, index) => {
        drawText(commands, line, x + 7, yTop - 17 - index * 11, fontSize, textColor);
    });
}

function drawText(commands, text, x, y, size, color) {
    commands.push(`${color} rg BT /F1 ${size} Tf ${formatNumber(x)} ${formatNumber(y)} Td (${escapePdfText(cleanPdfText(text))}) Tj ET`);
}

function buildPdf(content, pageWidth, pageHeight) {
    const objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>`,
        `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
    ];
    let pdf = "%PDF-1.4\n";
    const offsets = [0];

    objects.forEach((object, index) => {
        offsets.push(pdf.length);
        pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });

    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += "0000000000 65535 f \n";

    for (let index = 1; index < offsets.length; index++) {
        pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
    }

    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return pdf;
}

function getInputValue(name) {
    return document.querySelector(`[name="${name}"]`)?.value || "";
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function wrapText(text, maxChars) {
    const words = text.split(" ");
    const lines = [];
    let line = "";

    words.forEach((word) => {
        const nextLine = line ? `${line} ${word}` : word;

        if (nextLine.length > maxChars && line) {
            lines.push(line);
            line = word;
        } else {
            line = nextLine;
        }
    });

    if (line) {
        lines.push(line);
    }

    return lines.length ? lines : [""];
}

function cleanPdfText(value) {
    return String(value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\x20-\x7E]/g, "");
}

function escapePdfText(value) {
    return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function formatNumber(value) {
    return Number(value).toFixed(2).replace(/\.00$/, "");
}