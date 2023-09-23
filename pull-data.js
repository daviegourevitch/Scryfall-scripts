import fs from "fs";
import fetch from "node-fetch";

const WAIT_TIME = 100;
const MAX_CARDS_TO_QUERY = 2000;
const DIRECTORY = "./Pauper Cube Lists";
const DATA_FILE = "./data.json";

async function main() {
  console.log("Loading card names...");
  const cardNames = loadCardNames(DIRECTORY);
  console.log(`\tLoaded ${Object.keys(cardNames).length} card names\n`);
  console.log("Loading existing card data...");
  const existingCardData = loadExistingCardData(DATA_FILE);
    console.log(
      `\tLoaded ${Object.keys(existingCardData).length} existing card data\n`
    );
  console.log("Loading card data...");
  const cardData = await loadAllCards(cardNames, existingCardData);
  console.log(`\tLoaded ${Object.keys(cardData).length} card data\n`);
  writeDataToFile(cardData);
  console.log("Done!");
}

function loadCardNames(directory) {
  const files = fs.readdirSync(directory);
  const cardLists = files.filter((file) => file.endsWith(".txt"));
  const cardNames = {};
  for (const cardList of cardLists) {
    const lines = fs
      .readFileSync(`${directory}/${cardList}`, "utf8")
      .split("\n");
    for (const line of lines) {
      const cardName = line.trim().replace("\r", "");
      if (cardName.length > 0 && !cardName.startsWith("#")) {
        cardNames[cardName] = (cardNames[cardName] || 0) + 1;
      }
    }
  }
  return cardNames;
}

function loadExistingCardData(filename) {
  try {
    return JSON.parse(fs.readFileSync(filename, "utf8"));
  } catch (e) {
    return {};
  }
}

async function loadAllCards(cardNames, existingData) {
  const cardData = {};
  let limit = MAX_CARDS_TO_QUERY;
  for (const cardName of Object.keys(cardNames)) {
    if (cardName in existingData) {
      cardData[cardName] = existingData[cardName];
    } else {
      const data = await loadCardData(cardName);
      if (data) {
        cardData[cardName] = data;
      } else {
        console.log(`\t\tNo results for ${cardName}`)
        continue;
      }
      limit--;
    }
    cardData[cardName].numberOfCubes = cardNames[cardName];
    if (limit <= 0) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, WAIT_TIME));
  }
  return cardData;
}

async function loadCardData(cardName) {
  try {
    const url = `https://api.scryfall.com/cards/search?include_extras=true&q=${cardName}&unique=prints`;
    const response = await fetch(url);
    const json = await response.json();
    json.data = json.data.filter((card) => card.name === cardName || card.name.split(" // ")[0] === cardName);
    if (json.data.length === 0 || json.total_cards === 0) {
      console.log(`\t\tNo results for ${cardName}`);
      return null;
    }
    console.log(`Fetched ${cardName}`);
    return json;
  } catch (e) {
    console.log(`Error loading ${cardName}: ${e}`);
  }

  return null;
}

function writeDataToFile(cardData) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(cardData, null, 2));
}

main();
