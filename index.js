import fs from 'fs';
import fetch from 'node-fetch';

const WAIT_TIME = 200;
const DIRECTORY = './Pauper Cube Lists';
const VERBOSE = false;

async function main() {
    console.log('Loading cards to query...')
    const cardsNames = loadCards(DIRECTORY);
    console.log(`Loaded ${cardsNames.length} card names.`);
    const results = await loadAllCards(cardsNames);
    console.log(`Loaded ${results.length} results.`)
    fs.writeFileSync('./data.json', JSON.stringify(results));
    const cardsBySet = groupCardsBySet(results);
    // write results to a json file in case we want to use it later
    writeCSV(cardsBySet);
    console.log('Done!');
}

async function loadAllCards(cardsNames) {
    const results = [];
    for (const cardName of cardsNames) {
        VERBOSE && console.log(`Loading ${cardName}`)
        const loadedCard = alreadyLoadedCard(cardName);
        if (loadedCard) {
            results.push(loadedCard);
            VERBOSE && console.log(`Already loaded ${cardName}`);
        } else {
            await new Promise(resolve => setTimeout(resolve, WAIT_TIME));
            const queryResults = await queryCard(cardName);
            results.push(queryResults);
            VERBOSE && console.log(`Loaded ${cardName}`);
        }
    }
    return results;
}

const EXISTING_DATA = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
function alreadyLoadedCard(cardName) {
    for (const result of EXISTING_DATA) {
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
        VERBOSE && console.log(`... loading cards from ${cubeList} ...`);
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
                if (cardsBySet[card.set_name]) {
                    cardsBySet[card.set_name].push(card);
                } else {
                    cardsBySet[card.set_name] = [card];
                }
            });
        } catch (e) {
            console.error(`Error processing ${result}`);
            console.log({result});
            console.error(e);
        }
    });
    for (const set of Object.keys(cardsBySet)) {
        // remove duplicates
        cardsBySet[set] = cardsBySet[set].filter((card, index, self) => {
            return self.findIndex(c => c.name === card.name) === index;
        });
    }
    const setsToIgnore = [
        "Summer Magic / Edgar",
        "Mystery Booster",
        "The List",
        "Limited Edition Alpha",
        "Limited Edition Beta",
        "Unlimited Edition",
    ];
    for (const set of Object.keys(cardsBySet)) {
        if (setsToIgnore[set]) {
            delete cardsBySet[set];
        }
    }
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
        "Mana Cost",
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
                card.mana_cost,
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
