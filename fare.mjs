const routes = {
  Delhi: { Jaipur: 281, Agra: 233, Chandigarh: 243, Lucknow: 554 },
  Jaipur: { Ahmedabad: 665, Agra: 240 },
  Agra: { Lucknow: 335 },
  Lucknow: { Varanasi: 320 },
  Chandigarh: { Jaipur: 507 },
  Ahmedabad: { Mumbai: 524 },
  Mumbai: { Pune: 149, Hyderabad: 709 },
  Pune: { Hyderabad: 560 },
  Hyderabad: { Bengaluru: 570, Chennai: 626 },
  Bengaluru: { Chennai: 346 },
  Varanasi: { Delhi: 821, Kolkata: 681 },
  Chennai: { Kolkata: 1660 },
  Kolkata: {}
};

const rates = {
  train: { base: 35, rate: 1.03 },
  bus: { base: 20, rate: 1.08 },
  cab: { base: 70, rate: 13.7 },
  bike: { base: 15, rate: 5.2 }
};

const graph = Object.fromEntries(Object.keys(routes).map(city => [city, {}]));
for (const [city, neighbors] of Object.entries(routes)) {
  for (const [neighbor, distance] of Object.entries(neighbors)) {
    graph[city][neighbor] = distance;
    graph[neighbor][city] = distance;
  }
}

export function calculateFare(input) {
  const { origin, destination, mode, travellers } = input ?? {};
  if (typeof origin !== 'string' || typeof destination !== 'string' || !graph[origin] || !graph[destination] || origin === destination) {
    throw new Error('Choose two different supported cities.');
  }
  if (!Object.hasOwn(rates, mode)) throw new Error('Choose a supported travel mode.');
  if (!Number.isInteger(travellers) || travellers < 1 || travellers > 8) {
    throw new Error('Traveller count must be between 1 and 8.');
  }

  const distances = Object.fromEntries(Object.keys(graph).map(city => [city, Infinity]));
  const unvisited = new Set(Object.keys(graph));
  distances[origin] = 0;
  while (unvisited.size) {
    let current = null;
    for (const city of unvisited) {
      if (current === null || distances[city] < distances[current]) current = city;
    }
    if (current === null || distances[current] === Infinity) break;
    if (current === destination) break;
    unvisited.delete(current);
    for (const [neighbor, distance] of Object.entries(graph[current])) {
      if (!unvisited.has(neighbor)) continue;
      distances[neighbor] = Math.min(distances[neighbor], distances[current] + distance);
    }
  }

  const farePerTraveller = Math.round(rates[mode].base + distances[destination] * rates[mode].rate);
  return {
    origin,
    destination,
    mode,
    travellers,
    distance: distances[destination],
    amount: farePerTraveller * travellers * 100
  };
}