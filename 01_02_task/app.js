import {
  AI_API_KEY,
  AI_DEVS_API_KEY,
  buildResponsesRequest,
  EXTRA_API_HEADERS,
  resolveModelForProvider,
  RESPONSES_API_ENDPOINT
} from "../config.js";
import {readFileSync, writeFileSync} from "fs";
import {buildNextConversation, getFinalText, getToolCalls, logAnswer, logQuestion} from "../01_02_tools/helper.js";

const LOCATION_API_ENDPOINT = "https://hub.ag3nts.org/api/location";
const ACCESS_LEVEL_API_ENDPOINT = "https://hub.ag3nts.org/api/accesslevel";

const model = resolveModelForProvider("gpt-5.4");

async function findLocation(name, surname) {
  const response = await fetch(LOCATION_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      apikey: AI_DEVS_API_KEY,
      name: name,
      surname: surname
    })
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    const message = data?.error?.message ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data;
}

async function getAccessLevel(name, surname, birthYear) {
  const response = await fetch(ACCESS_LEVEL_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      apikey: AI_DEVS_API_KEY,
      name: name,
      surname: surname,
      birthYear: birthYear
    })
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    const message = data?.error?.message ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data;
}

function measureDistance(lat1, lon1, lat2, lon2) {
  const toRadians = (degrees) => degrees * (Math.PI / 180);
  const R = 6371; // Earth radius in kilometers

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
}

const ALLOWED_FILES = [
    "findhim_locations.json",
    "people.json",
    "power_plants.json",
    "people_location.json"
]
const ALLOWED_WRITE_FILES = [
    "power_plants.json",
    "people_location.json"
]

const tools = [
  {
    type: "function",
    name: "find_location",
    description: "Get all known locations of a person based on their name and surname",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Person name" },
        surname: { type: "string", description: "Person surname" },
      },
      required: ["name", "surname"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "get_access_level",
    description: "Get access level of a person based on their name, surname and birth year",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Person name" },
        surname: { type: "string", description: "Person surname" },
        birth_year: { type: "number", description: "Person birth year" },
      },
      required: ["name", "surname", "birth_year"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "read_file",
    description: "Read the contents of a file",
    parameters: {
      type: "object",
      properties: {
        filename: {type: "string", enum: ALLOWED_FILES, description: "Name of file to read"},
      },
      required: ["filename"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "measure_distance",
    description: "Measure distance between coordinates",
    parameters: {
      type: "object",
      properties: {
        lat1: { type: "number", description: "Latitude of 1st place" },
        lon1: { type: "number", description: "Longitude of 1st place" },
        lat2: { type: "number", description: "Longitude of 2nd place" },
        lon2: { type: "number", description: "Longitude of 2nd place" },
      },
      required: ["lat1", "lon1", "lat2", "lon2"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "measure_all_distances",
    description: "Measure all distances between array of coordinates from and array of coordinates to",
    parameters: {
      type: "object",
      properties: {
        coordinates_from: {
          type: "array",
          description: "Array of coordinates to measure distance from",
          items: {
            type: "object",
            properties: {
              lat: { type: "number", description: "Latitude" },
              lon: { type: "number", description: "Longitude" },
            },
            required: ["lat", "lon"],
            additionalProperties: false
          },
        },
        coordinates_to: {
          type: "array",
          description: "Array of coordinates to measure distance to",
          items: {
            type: "object",
            properties: {
              lat: { type: "number", description: "Latitude" },
              lon: { type: "number", description: "Longitude" },
            },
            required: ["lat", "lon"],
            additionalProperties: false
          },
        },
      },
      required: ["coordinates_from", "coordinates_to"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "write_file",
    description: "Write contents to the file",
    parameters: {
      type: "object",
      properties: {
        filename: {type: "string", enum: ALLOWED_WRITE_FILES, description: "Name of file to write"},
        content: {type: "string", description: "Content of the file"},
      },
      required: ["filename", "content"],
      additionalProperties: false,
    },
    strict: true,
  },
];

const handlers = {
  find_location({name, surname}) {
    return findLocation(name, surname);
  },
  get_access_level({name, surname, birth_year}) {
    return getAccessLevel(name, surname, birth_year);
  },
  read_file({filename}) {
    if (!ALLOWED_FILES.includes(filename)) {
      throw new Error(`You can only read ${ALLOWED_FILES}`)
    }
    return readFileSync(filename, "utf-8");
  },
  write_file({filename, content}) {
    if (!ALLOWED_WRITE_FILES.includes(filename)) {
      throw new Error(`You can only write to ${ALLOWED_WRITE_FILES}`)
    }
    writeFileSync(filename, content);
    return "success"
  },
  measure_distance({lat1, lon1, lat2, lon2}) {
    return measureDistance(lat1, lon1, lat2, lon2);
  },
  measure_all_distances({coordinates_from, coordinates_to}) {
    const results = [];
    for (const coordinate_from of coordinates_from) {
      for (const coordinate_to of coordinates_to) {
        results.push({
          from: coordinate_from,
          to: coordinate_to,
          distance: measureDistance(coordinate_from.lat, coordinate_from.lon, coordinate_to.lat, coordinate_to.lon)
        })
      }
    }
    return results;
  }
};

const requestResponse = async (input) => {
  const webSearch = true
  const body = buildResponsesRequest({
    model,
    input,
    tools,
    webSearch,
  });

  const response = await fetch(RESPONSES_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_API_KEY}`,
      ...EXTRA_API_HEADERS,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message ?? `Request failed (${response.status})`);
  return data;
};

const MAX_TOOL_STEPS = 15;

const chat = async (conversation) => {
  let currentConversation = conversation;
  let stepsRemaining = MAX_TOOL_STEPS;

  while (stepsRemaining > 0) {
    stepsRemaining -= 1;

    const response = await requestResponse(currentConversation);
    const toolCalls = getToolCalls(response);

    if (toolCalls.length === 0) {
      console.log(`Loop run ${MAX_TOOL_STEPS - stepsRemaining} times`)
      return getFinalText(response);
    }

    currentConversation = await buildNextConversation(currentConversation, toolCalls, handlers);
  }

  throw new Error(`Tool calling did not finish within ${MAX_TOOL_STEPS} steps.`);
};

// const query = `
// people.json file contains information about people, including their name, surname, birth year and other details.
// findhim_locations.json file contains information about cities where power plants are located.
// Using available tools find person that was the closest to one of power plants base on all known locations and get only their access level.
// Base distance to power plant only on known locations that user visited.
// Return result in format: {name, surname, accessLevel, powerPlant} where powerPlant is the 'code' in findhim_location.json
// If some tool fail, retry once
// `;

// people.json file contains information about people, including their name, surname, birth year and other details.
// 2. find all known locations for each person in people.json
// 3. measure distance from each person's location to each power plant and find minimum
// 4. print minimal distance for each person

// 4. get access level for person that was the closest to any of power plants
// 5. Return result in format: {name, surname, accessLevel, powerPlant} where powerPlant is the 'code' in findhim_location.json

//1
// const query = `
// findhim_locations.json file contains information about cities where power plants are located.
// find coordinates for all plants based on city name in findhim_locations.json (using web search)
// generate json in format: {code, latitude, longitude} and save it to power_plants.json
// `;
//2
// const query = `
// people.json file contains information about people, including their name, surname, birth year and other details.
// find all known locations for each person in people.json
// generate json in format: {name, surname, born, [{latitude, longitude}]} and save it to people_location.json
// `;
//3
// const query = `
// people_location.json file contains information about people, including their name, surname, birth year and visited locations' coordinates
// power_plants.json contains information about power plants, including their code and coordinates
// measure distance between each person's visited locations and each power plant
// and print distances for all people
// then print the minimum distance that was observed and for which person and which power plant location was the closest (please print more than one person when results are similar)
// then get access level for this person and print all in format: {name, surname, accessLevel, powerPlant} where powerPlant is the 'code'
// `;
// logQuestion(query);
//
// const answer = await chat([{ role: "user", content: query }]);
// logAnswer(answer);

const answer = {
  apikey: AI_DEVS_API_KEY,
  task: "findhim",
  "answer": readFileSync('./result.json', "utf-8")
}
console.log(answer);
const response = await fetch("https://hub.ag3nts.org/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(answer)
});

const data = await response.json();
console.log(data);