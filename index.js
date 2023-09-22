import fs from 'fs';
import fetch from 'node-fetch';

const WAIT_TIME = 200;
const DIRECTORY = './Pauper Cube Lists';

// pull the already loaded cards from the json file 'data.json
const alreadyLoadedCards = JSON.parse(fs.readFileSync('./data.json', 'utf8'));

async function main() {
    console.log('Loading cards...')
    const CARDS = loadCards(DIRECTORY);
    console.log(`Loaded ${CARDS.length} cards.`);
    const results = [];
    for (const cardName of CARDS) {
        const loadedCard = alreadyLoadedCard(cardName);
        if (loadedCard) {
            // console.log(`Skipping ${cardName} because it has already been loaded.`);
            results.push(loadedCard);
        } else {
            await new Promise(resolve => setTimeout(resolve, WAIT_TIME));
            const queryResults = await queryCard(cardName);
            results.push(queryResults);
        }
    }
    fs.writeFileSync('./data.json', JSON.stringify(results));
    const cardsBySet = groupCardsBySet(results);
    // write results to a json file in case we want to use it later
    writeCSV(cardsBySet);
    console.log('Done!');
}

function alreadyLoadedCard(cardName) {
    for (const result of alreadyLoadedCards) {
        if (result.data) {
            for (const card of result.data) {
                if (card.name === cardName) {
                    return result;
                }
            }
        }
    }
    return null;
}

function loadCards(directory) {
    const cubeLists = fs.readdirSync(directory);
    const cards = [];
    const ignore = [
        "Plains",
        "Island",
        "Swamp",
        "Mountain",
        "Forest",
    ];
    cubeLists.forEach(cubeList => {
        const cubeListContents = fs.readFileSync(`./Pauper Cube Lists/${cubeList}`, 'utf8');
        const cubeListCards = cubeListContents.split('\n');
        cubeListCards.forEach(card => {
            card = card.replace('\r', '');
            if (!cards.includes(card) && card[0] !== "#" && !ignore.includes(card) && card !== "") {
                cards.push(card);
            }
        });
    });
    return cards;
}

async function queryCard(cardName) {
    const url = `https://api.scryfall.com/cards/search?include_extras=true&q=${cardName}&unique=prints`;
    const response = await fetch(url);
    const json = await response.json();
    if (json.hasMore) {
        console.error(`\tThere is another page of results for ${cardName}!`);
    }
    if (json.status === 404) {
        console.error(`\t404 for ${cardName}`);
    } else {
        console.log(`${cardName} - ${json.total_cards || 0} results`);
    }
    return json;
}

function groupCardsBySet(queryResults) {
    const cardsBySet = {};
    queryResults.forEach(result => {
        try {
            if (!result.data) {
                console.error(`No data.`)
                console.log({result})
                return;
            }
            result.data?.forEach(card => {
                if (shouldIgnoreCard(card)) {
                    return;
                }
                if (cardsBySet[card.set]) {
                    cardsBySet[card.set].push(card);
                } else {
                    cardsBySet[card.set] = [card];
                }
            });
        } catch (e) {
            console.error(`Error processing ${result}`);
            console.log({result});
            console.error(e);
        }
    });
    for (const set of Object.keys(cardsBySet)) {
        cardsBySet[set].sort((a, b) => {
            // sort by collector's number
            return parseInt(a.collector_number) - parseInt(b.collector_number);
        });
    }
    return cardsBySet;
}

function shouldIgnoreCard(card) {
    // ignore cards that are not in paper
    if (card.digital) {
        return true;
    }
    // ignore cards that are not in English
    if (card.lang !== "en") {
        return true;
    }
    // ignore set types that we don't care about
    if (["masterpiece", "alchemy", "memorabilia"].includes(card.set_type)) {
        return true;
    }
    return false;
}

function writeCSV(cardsBySet) {
    const headers = [
        "Set",
        "Release Date",
        "Set Type",
        "Card Name",
        "Card No.",
        "Type",
        "Rarity",
        "Price"
    ];
    const rows = [];
    Object.keys(cardsBySet).forEach(set => {
        cardsBySet[set].forEach(card => {
            rows.push([
                card.set_name,
                card.released_at,
                card.set_type,
                card.name.replace(",", ".").replace("—", "-"),
                card.collector_number,
                card.type_line,
                card.rarity,
                card.prices.usd,
            ]);
        });
    });
    // sort by release date, oldest to newest then by collector's number
    rows.sort((a, b) => {
        if (a[1] === b[1]) {
            return parseInt(a[4]) - parseInt(b[4]);
        }
        return new Date(a[1]) - new Date(b[1]);
    });
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    fs.writeFileSync('./cards.csv', csv);
}

main();
