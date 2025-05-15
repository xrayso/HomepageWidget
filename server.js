const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // Using v2 to allow require()
const JSZip = require('jszip');
const Papa = require('papaparse');
const path = require('path');


const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());

// Serve static files from public/, including demo.html
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Optional: Redirect root to demo.html (if you want / to load the demo)
 */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'demo.html'));
});


async function latestTableZipUrl() {
    const FM_PACKAGE = '7680320b-c837-4b67-b73f-9361c4a9716d';    
    const meta = await fetch(
        `https://open.canada.ca/data/api/3/action/package_show?id=${FM_PACKAGE}`
    ).then(r => r.json());

    const zips = meta.result.resources
        .filter(r => r.format === 'ZIP' && /Data tables/.test(r.name));

    zips.sort((a,b) => new Date(b.created) - new Date(a.created));
    return zips[0].url;      
}

async function zipCsvText(tableNumber) {
    const zipUrl = await latestTableZipUrl();
    const zipRes = await fetch(zipUrl);
    const arrayBuffer = await zipRes.arrayBuffer();
    const zip = await JSZip.loadAsync(Buffer.from(arrayBuffer));

    const tableRegex = new RegExp(`Table_${tableNumber}\\b`, 'i');
    const fileEntry = Object.values(zip.files).find(f => tableRegex.test(f.name));

    if (!fileEntry) throw new Error(`Table_${tableNumber} CSV not found in ZIP`);
    return await fileEntry.async('string');
}

function findRowMatchingREGEX(data, regex){
    for (const row of data) {
        const label = String(row[0]).trim();
        if (regex.test(label)) {
            return row;
        }
    }
}
// 1️⃣ National Debt (StatCan vector API)
app.get('/national-debt', async (req, res) => {
  try {
    const csvText = await zipCsvText(7);
    const { data } = Papa.parse(csvText, {
        skipEmptyLines: true,
    });
    const regex = /^Federal debt.*accumulated deficit\)?$/i
    // console.log(data);
    const row = findRowMatchingREGEX(data, regex);
    const rawValue = Math.abs(Number(row[2].replace(/[^0-9.-]+/g,"")));
    const asOf = data[2][2];
    res.json({ asOf, value: (rawValue*1e6) });
    
  } catch (err) {
    console.error('Error fetching national debt:', err);
    res.status(500).json({ error: err.message });
  }
});
app.get('/deficit', async (req, res) => {
  try {
    
    const csvText = await zipCsvText(1);

    const { data } = Papa.parse(csvText, {
        skipEmptyLines: true,
    });

    const BALANCE_REGEX = /^Budgetary balance.*deficit\/surplus/i;
    const row = findRowMatchingREGEX(data, BALANCE_REGEX);
    const rawValue = Math.abs(Number(row[2].replace(/[^0-9.-]+/g,"")));
    const asOf = data[2][2];
    res.json({ asOf, value: (rawValue*1e6) });

  } catch (err) {
    console.error('Error fetching deficit:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3️⃣ Procurement Spend (OCDS JSON)
app.get('/procurement', async (req, res) => {
  try {
    const csvText = await zipCsvText(4);
    const { data } = Papa.parse(csvText, {
        skipEmptyLines: true,
    });
    const procurementRegexes = [
        /professional\s+and\s+special\s+services?/i,
        /rentals?/i,
        /repair\s+and\s+maintenance/i,
        /utilities?,?\s*materials?\s*(and)?\s*supplies?/i,
        /transportation\s+and\s+communications?/i
    ];
    let rawValue = 0;
    for (let regex of procurementRegexes){
        const row = findRowMatchingREGEX(data, regex);
        const number = Math.abs(Number(row[2].replace(/[^0-9.-]+/g,"")));
        rawValue += number;
        console.log(number);
    }
    const asOf = data[2][2];
    
    res.json({ asOf, value: (rawValue*1e6) });
  } catch (err) {
    console.error('Error fetching procurement:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/interest', async (_req, res) => {
    try {
        
        const csvText = await zipCsvText(1);
        const { data } = Papa.parse(csvText, {
            skipEmptyLines: true,
        });

        const regex = /^Public debt charges/i;
        const row = findRowMatchingREGEX(data, regex);
        const rawValue = Math.abs(Number(row[2].replace(/[^0-9.-]+/g,"")));
        const asOf = data[2][2];
        res.json({ asOf, value: (rawValue*1e6) });

    } catch (err) {
        console.error('Error fetching deficit:', err);
        res.status(500).json({ error: err.message });
    }
});
// 4️⃣ Federal Payroll (placeholder)
app.get('/payroll', async (_req, res) => {
  const csvText = await zipCsvText(4);
  const { data } = Papa.parse(csvText, {
    skipEmptyLines: true,
  });
  
  const row = findRowMatchingREGEX(data, /^Personnel, excluding net actuarial losses/i);
  const rawValue = Math.abs(Number(row[2].replace(/[^0-9.-]+/g,"")));
  const asOf = data[2][2];
  res.json({ asOf, value: (rawValue*1e6) });

});

app.listen(PORT, () => {
  console.log(`Canada Fiscal Badge API listening on port ${PORT}`);
});