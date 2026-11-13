"""Berlin · A City Passport. 7 stamp pages x 4 stops, then laws/customs and German phrase pages."""

CODE = "ber"
TITLE = "Berlin · A City Passport"
COUNTRY = "DE"
COUNTRY_NAME = "Germany"
STATE = "Berlin"
CITY = "Berlin"
EMBLEM = "🐻"
COVER_BG = "1E2A44"
PAPER = "F4F1EA"
TITLE_INK = "1E2A44"
INFO_INK = "4E5A6E"

DESCRIPTION = ("Berlin from the Brandenburg Gate to the Wall: the Reichstag dome and the Holocaust Memorial, Museum Island "
    "and the cathedral, the East Side Gallery and Checkpoint Charlie, Gendarmenmarkt and the TV Tower, the Kaiser Wilhelm "
    "Memorial Church and Charlottenburg Palace, a day in Potsdam, and four long-running Berlin food stops, plus two pages "
    "of laws, money and customs for visitors from the US.")

SPEND_TIER = "150_500"
SPEND_NOTE = ("Expect roughly 150 to 220 euros a person (about $175 to $255), not counting the train to Potsdam, which a "
    "Berlin ABC ticket covers. The biggest costs are the TV Tower (from about 24.50 euros online), the Museum Island day ticket "
    "(24 euros), Charlottenburg Palace and Sanssouci. The Brandenburg Gate, the Reichstag dome, the Holocaust Memorial, the "
    "East Side Gallery, the Wall Memorial, the Topography of Terror and Glienicke Bridge are free. Book the Reichstag dome "
    "ahead; it is free but needs registration.")

# page: (title, ink colour for frame/background, motif strip key)
PAGES = [
    ("The Gate & the Reichstag", "5A6E8E"),
    ("Museum Island", "6E6A86"),
    ("The Wall & the Cold War", "7A6A5A"),
    ("Mitte Squares & the Tower", "5A7A6E"),
    ("City West", "8A6A4A"),
    ("Potsdam Day Trip", "6E7A4A"),
    ("Berlin Eats", "8E4A44"),
]

S = []  # stops in page order, 4 per page

def stop(**k):
    S.append(k)

# ---------- Page 1 ----------
stop(slug="brandenburg-gate", name="Brandenburg Gate", year="1791", street="Pariser Platz", zip="10117",
    lat=52.516275, lng=13.377704, radius=90, ink="5A4A2E", cls=["architecture", "heritage", "free"], tier="free",
    desc="Berlin's neoclassical city gate, built for King Frederick William II and topped by the Quadriga, a goddess driving a four-horse chariot. Walk through from Pariser Platz on the east side to the Tiergarten on the west, the line where the Wall cut the city until 1989. Plan 20 minutes.",
    facts=["Carl Gotthard Langhans modeled the gate on the Propylaea, the entrance to the Acropolis in Athens.",
           "Napoleon carried the Quadriga off to Paris in 1806; it came back to Berlin in 1814."],
    good="Free and open at all hours. Early morning is quietest for photos. Brandenburger Tor station (S-Bahn and U5) is on Pariser Platz.",
    prompt="Stand under the middle arch, then step back onto Pariser Platz. What do you think it meant to walk through here freely after 1989?",
    obj="Explain how the Brandenburg Gate went from a royal city gate to the symbol of a divided and then reunited Berlin.",
    stamp=("arch", "gate", "BRANDENBURG", "GATE"))

stop(slug="reichstag", name="Reichstag Dome", year="1894", street="Platz der Republik 1", zip="11011",
    lat=52.518620, lng=13.376187, radius=100, ink="3E5A70", cls=["architecture", "heritage", "free", "views"], tier="free",
    desc="The seat of the German parliament, the Bundestag, under Norman Foster's glass dome. Walk the spiral ramp up the dome, look down through the glass into the debating chamber, and take in the government quarter and the Tiergarten from the roof terrace. Plan 90 minutes including security.",
    facts=["Foster's glass and steel dome opened in 1999 and stands 23.5 metres high.",
           "Graffiti left by Soviet soldiers in 1945 was kept on some interior walls during the rebuilding."],
    good="Free, but you must register ahead on the Bundestag website with your name and date of birth, and bring photo ID. Same-day spots are sometimes available at the service centre near the building, at least two hours ahead. The dome closes for cleaning for some weeks each year.",
    prompt="Look down from the dome into the chamber below. How does it feel to stand above the people who run the country?",
    obj="Describe why the Reichstag's glass dome is meant to show transparency between the public and parliament.",
    stamp=("circle", "dome", "REICHSTAG", "BERLIN"))

stop(slug="holocaust-memorial", name="Memorial to the Murdered Jews of Europe", year="2005", street="Cora-Berliner-Straße 1", zip="10117",
    lat=52.513889, lng=13.378889, radius=110, ink="4A4E58", cls=["heritage", "free", "memorial"], tier="free",
    desc="Peter Eisenman's field of 2,711 concrete slabs on a sloping site south of the Brandenburg Gate. Walk into the rows until the ground drops and the slabs rise over your head, then visit the underground information centre with names and family stories. Plan an hour.",
    facts=["The slabs all share the same footprint but vary in height, from flat on the ground to more than four metres.",
           "The information centre below the field lists the names of Jewish victims of the Holocaust and tells individual family histories."],
    good="The field is open at all hours and free. The information centre is free and closed on Mondays. This is a memorial: do not climb, jump between or sit on the slabs.",
    prompt="Walk to the middle of the field and stop. What changed as the slabs rose around you, and what did you think about?",
    obj="Reflect on how an abstract memorial uses space and height to make visitors feel isolation and loss.",
    stamp=("rect", "stelae", "MEMORIAL", "BERLIN"))

stop(slug="victory-column", name="Victory Column", year="1873", street="Großer Stern 1", zip="10557",
    lat=52.514543, lng=13.350119, radius=90, ink="9A7A2E", cls=["heritage", "views", "outdoor"], tier="5_to_15",
    desc="A tall column with a gilded goddess of victory on top, standing in the middle of the Tiergarten's big roundabout. Take the pedestrian tunnels to the base, then climb the 285 steps for a view down the long avenue to the Brandenburg Gate. Plan 45 minutes.",
    facts=["The column marks Prussia's victories over Denmark, Austria and France in the 1860s and 1870s.",
           "The Nazis moved it here from in front of the Reichstag in 1939 and added an extra drum to make it taller."],
    good="There is a small entry fee to climb, and no lift. Reach it only through the underground passages; never cross the traffic circle on foot. Bus 100 stops at Großer Stern.",
    prompt="From the top, follow the avenue east with your eyes. Which Berlin landmarks can you pick out, and which surprised you?",
    obj="Explain what the Victory Column commemorates and why it was moved to the Großer Stern in 1939.",
    stamp=("shield", "column", "VICTORY", "COLUMN"))

# ---------- Page 2 ----------
stop(slug="berliner-dom", name="Berlin Cathedral", year="1905", street="Am Lustgarten", zip="10178",
    lat=52.519133, lng=13.401095, radius=90, ink="3E6A5A", cls=["architecture", "heritage", "views"], tier="15_to_50",
    desc="The great green-domed Protestant cathedral on Museum Island, facing the Lustgarten lawn. See the gilded interior and the organ, go down to the crypt of the Hohenzollern royal family, then climb to the outdoor walkway around the dome. Plan an hour.",
    facts=["The present building was finished in 1905 under Emperor Wilhelm II.",
           "The crypt holds close to 100 coffins and tombs of the Hohenzollern family."],
    good="Paid entry, with the dome walk and crypt included. The dome walk is about 270 steps and has no lift. Services and concerts close the church to sightseers at times.",
    prompt="Out on the dome walkway, look across the river at the rebuilt palace and the TV Tower. What does this view say about Berlin's mix of old and new?",
    obj="Describe the role of the Hohenzollern dynasty in Berlin and how the cathedral and its crypt reflect it.",
    stamp=("circle", "cathedral", "BERLINER", "DOM"))

stop(slug="neues-museum", name="Neues Museum", year="1855", street="Bodestraße 1-3", zip="10178",
    lat=52.520014, lng=13.397767, radius=60, ink="9A6A2E", cls=["museum", "heritage", "architecture"], tier="5_to_15",
    desc="The museum of Egyptian art and early history on Museum Island, home of the painted bust of Queen Nefertiti. Find her in the north dome room, then look at the Berlin Gold Hat and at how the rebuilt building leaves its war damage on show. Plan two hours.",
    facts=["The Nefertiti bust, made around 1345 BC, was found in 1912 in the workshop of the sculptor Thutmose at Amarna.",
           "The museum stood as a bombed ruin for decades; David Chipperfield's rebuild reopened it in 2009."],
    good="Tickets are 14 euros, or 24 euros for the Museum Island day ticket. Open Tuesday to Sunday, 10am to 6pm, closed Mondays. Under-18s go free but still need a ticket. Photos of Nefertiti are not allowed in her room.",
    prompt="Stand in front of Nefertiti, then walk round to her other side. Why do you think one eye was never finished?",
    obj="Describe how the Neues Museum's restoration keeps the scars of the Second World War as part of its story.",
    stamp=("oval", "bust", "NEUES", "MUSEUM"))

stop(slug="alte-nationalgalerie", name="Alte Nationalgalerie", year="1876", street="Bodestraße 1-3", zip="10178",
    lat=52.520849, lng=13.398096, radius=60, ink="7A4A3E", cls=["museum", "art", "architecture"], tier="5_to_15",
    desc="A temple-like gallery on a high base, built for 19th-century German painting and sculpture. Look for Caspar David Friedrich's Romantic landscapes, Adolph Menzel's Berlin scenes and the French Impressionists, then sit in the colonnade garden outside. Plan 90 minutes.",
    facts=["Friedrich August Stüler designed the building to look like a Corinthian temple raised on a podium.",
           "An equestrian statue of King Frederick William IV stands at the top of the outside staircase."],
    good="Covered by the Museum Island day ticket. Open Tuesday to Sunday, closed Mondays. The colonnade garden in front is free.",
    prompt="Find one Caspar David Friedrich painting and stand in front of it for a full minute. What is the figure in it looking at, and what do you feel?",
    obj="Identify key features of German Romantic painting through the works of Caspar David Friedrich.",
    stamp=("rect", "temple", "ALTE NATIONAL", "GALERIE"))

stop(slug="humboldt-forum", name="Humboldt Forum", year="2020", street="Schlossplatz", zip="10178",
    lat=52.517500, lng=13.402500, radius=90, ink="8A5A3A", cls=["museum", "architecture", "heritage", "views"], tier="free",
    desc="A museum and culture centre inside a rebuilt copy of the Berlin Palace, with three baroque facades and one modern one. Walk through the Schlüterhof courtyard, see the exhibition on the site's history in the basement, and go up to the roof terrace for the view over Museum Island. Plan 90 minutes.",
    facts=["The Palace of the Republic, East Germany's parliament building, stood on this site until it was demolished in the 2000s.",
           "The rebuilt baroque facades copy the palace damaged in the war and blown up by the East German government in 1950."],
    good="Entry to the building, the courtyards and many exhibitions is free; some special exhibitions and the roof terrace charge. Closed on Tuesdays.",
    prompt="Find the one facade that is not baroque. Do you think Berlin should rebuild lost buildings, or build new ones? Why?",
    obj="Explain the debate over rebuilding the Berlin Palace in place of the East German Palace of the Republic.",
    stamp=("octagon", "palace", "HUMBOLDT", "FORUM"))

# ---------- Page 3 ----------
stop(slug="east-side-gallery", name="East Side Gallery", year="1990", street="Mühlenstraße", zip="10243",
    lat=52.505030, lng=13.439762, radius=150, ink="8E3A3A", cls=["art", "heritage", "free", "outdoor"], tier="free",
    desc="The longest surviving stretch of the Berlin Wall, about 1.3 kilometres along the Spree, painted by artists from around the world in 1990. Walk the river side of the wall from Ostbahnhof toward the Oberbaum Bridge and stop at the murals that stay with you. Plan an hour.",
    facts=["More than 100 artists from about 21 countries painted the first murals in 1990.",
           "This section was the inner wall, facing East Berlin; the river beyond it was the border."],
    good="Free and open at all hours. The murals are protected artworks, so do not write on or touch them. Warschauer Straße station is at the east end.",
    prompt="Pick one mural you did not expect to like. What does it say, and why do you think the artist chose this wall?",
    obj="Describe how artists turned a surviving section of the Berlin Wall into a gallery about freedom after 1989.",
    stamp=("rect", "wallart", "EAST SIDE", "GALLERY"))

stop(slug="wall-memorial", name="Berlin Wall Memorial", year="1998", street="Bernauer Straße 111", zip="13355",
    lat=52.535150, lng=13.390200, radius=150, ink="4A4A4E", cls=["heritage", "free", "memorial", "outdoor"], tier="free",
    desc="The main memorial to the Wall, along Bernauer Straße, where the border ran down the middle of a residential street. See the preserved strip of wall, the death strip and watchtower behind it, the steel rods that mark where the wall stood, and the view from the documentation centre tower. Plan 90 minutes.",
    facts=["Along Bernauer Straße the house fronts were the border itself; in 1961 people jumped from their windows to reach the West.",
           "The outdoor exhibition marks escape tunnels and the windows of the Chapel of Reconciliation site."],
    good="The outdoor site is free and open at all hours; the visitor and documentation centres are free and closed on Mondays. Nordbahnhof S-Bahn station is next to the memorial.",
    prompt="Stand at the line of steel rods and look at the houses across the street. What would it have been like to live with the border outside your door?",
    obj="Explain how the Berlin Wall divided neighbourhoods and families, using the history of Bernauer Straße.",
    stamp=("rect", "watchtower", "WALL", "MEMORIAL"))

stop(slug="checkpoint-charlie", name="Checkpoint Charlie", year="1961", street="Friedrichstraße 43-45", zip="10117",
    lat=52.507538, lng=13.390391, radius=80, ink="5A5A3A", cls=["heritage", "free", "quirky"], tier="free",
    desc="The best-known crossing point between East and West Berlin during the Cold War, now marked by a replica guard hut on Friedrichstraße. Read the open-air panels on the corner about the October 1961 tank standoff, then look for the line of cobblestones marking where the Wall ran. Plan 30 minutes.",
    facts=["In October 1961 US and Soviet tanks faced each other here for about 16 hours.",
           "The guard hut on the street is a copy; the last original hut is in the Allied Museum."],
    good="Free and open at all hours. The actors in uniforms charge for photos. Kochstraße station (U6) is next to it.",
    prompt="Stand where the cars would have stopped. What would you have packed if you had been crossing into the East for a day?",
    obj="Describe the 1961 tank standoff at Checkpoint Charlie and what it showed about Cold War tensions.",
    stamp=("rect", "booth", "CHECKPOINT", "CHARLIE"))

stop(slug="topography-of-terror", name="Topography of Terror", year="2010", street="Niederkirchnerstraße 8", zip="10963",
    lat=52.506600, lng=13.383800, radius=100, ink="4E4A44", cls=["museum", "heritage", "free", "memorial"], tier="free",
    desc="A documentation centre on the site where the headquarters of the Gestapo and the SS stood. Walk the outdoor trench exhibition along a surviving stretch of the Wall, then go inside for the main exhibition on how the Nazi police state worked. Plan 90 minutes.",
    facts=["The Gestapo headquarters at Prinz-Albrecht-Straße 8 had its own prison cells; their foundations were dug up in the 1980s.",
           "About 200 metres of the Berlin Wall still stands along the north edge of the site."],
    good="Free, open daily from 10am. The exhibitions are serious and detailed, and suit older children and adults.",
    prompt="Find one document in the exhibition written by an ordinary office worker. What does it tell you about how a police state runs?",
    obj="Explain how the Gestapo and SS used this site to organise persecution under the Nazi regime.",
    stamp=("rect", "documents", "TOPOGRAPHY", "OF TERROR"))

# ---------- Page 4 ----------
stop(slug="gendarmenmarkt", name="Gendarmenmarkt", year="1688", street="Gendarmenmarkt", zip="10117",
    lat=52.513611, lng=13.392778, radius=120, ink="5A6A8A", cls=["architecture", "heritage", "free"], tier="free",
    desc="One of Berlin's grandest squares, framed by the twin French and German churches with the Konzerthaus between them. Walk around the square, look at the matching domed towers, and listen for organ or orchestra rehearsals from the doors. Plan 30 minutes.",
    facts=["The French Church was built for the Huguenots, French Protestant refugees who settled in Berlin from 1685.",
           "The square is named for the Gens d'armes, a cavalry regiment whose stables stood here in the 1700s."],
    good="The square is free and open at all hours. It hosts a well-known Christmas market from late November.",
    prompt="Compare the two churches side by side. Can you spot any difference between them, and why do you think they were built to match?",
    obj="Explain how Huguenot refugees shaped Berlin, using the French Church on Gendarmenmarkt.",
    stamp=("circle", "twinchurch", "GENDARMEN", "MARKT"))

stop(slug="bebelplatz", name="Bebelplatz Book Burning Memorial", year="1995", street="Bebelplatz", zip="10117",
    lat=52.516389, lng=13.394167, radius=80, ink="6A5A4A", cls=["heritage", "free", "memorial"], tier="free",
    desc="The square beside the State Opera where Nazi students burned about 20,000 books on 10 May 1933. Find the glass panel set into the paving and look down into Micha Ullman's underground room of empty white bookshelves. Plan 15 minutes.",
    facts=["Ullman's memorial, called The Library, has shelf space for about 20,000 books, the number burned here.",
           "A plaque nearby quotes Heinrich Heine, writing in 1820: where they burn books, they will in the end burn people too."],
    good="Free and open at all hours. The empty shelves show best at night, when the room is lit. Hausvogteiplatz and Unter den Linden stations are a few minutes away.",
    prompt="Look into the empty library. Which book would you most hate to lose, and why?",
    obj="Describe the 1933 book burning and how the Bebelplatz memorial uses empty space to mark what was lost.",
    stamp=("rect", "bookshelf", "BEBELPLATZ", "1933"))

stop(slug="tv-tower", name="Berlin TV Tower", year="1969", street="Panoramastraße 1A", zip="10178",
    lat=52.520815, lng=13.409419, radius=80, ink="5A6A7A", cls=["architecture", "views", "heritage"], tier="15_to_50",
    desc="East Germany's television tower at Alexanderplatz, the tallest structure in Germany, with a steel sphere near the top. Ride the lift in about 40 seconds to the observation deck at 203 metres and walk the full circle of windows over the city. Plan an hour.",
    facts=["The tower was opened in 1969 to show off East Germany's technical skill.",
           "When the sun hits the sphere a bright cross appears on it, which Berliners nicknamed the Pope's revenge."],
    good="Book a timed ticket online, from about 24.50 euros; walk-up prices are higher and queues can be long. The deck is open daily from 9am to 11pm. Alexanderplatz station is at the foot of the tower.",
    prompt="Find the Brandenburg Gate and the Reichstag from the sphere. How does the city's old east-west line look from up here?",
    obj="Explain why East Germany built the TV Tower and how it became a symbol for all of Berlin.",
    stamp=("circle", "tvtower", "FERNSEHTURM", "BERLIN"))

stop(slug="hackesche-hoefe", name="Hackesche Höfe", year="1906", street="Rosenthaler Straße 40-41", zip="10178",
    lat=52.524100, lng=13.402300, radius=60, ink="3E6A6A", cls=["architecture", "heritage", "free", "shopping"], tier="free",
    desc="A chain of eight linked courtyards off Rosenthaler Straße, the first of them faced in glazed Art Nouveau tiles. Walk through the courtyards from one street to the next, and look at the small shops, the cinema and the workshops that fill them. Plan 30 minutes.",
    facts=["The first courtyard's tiled facades were designed by the Art Nouveau architect August Endell.",
           "Next door, the Otto Weidt workshop museum tells how a brush maker hid and protected Jewish workers during the war."],
    good="The courtyards are free to walk through during the day; respect the residents who live there. Hackescher Markt S-Bahn station is across the street.",
    prompt="Walk from the first tiled courtyard to the quietest one. How does the mood change as you go deeper?",
    obj="Describe how Berlin's courtyard buildings mixed homes, workshops and businesses around a chain of yards.",
    stamp=("arch", "courtyard", "HACKESCHE", "HÖFE"))

# ---------- Page 5 ----------
stop(slug="gedaechtniskirche", name="Kaiser Wilhelm Memorial Church", year="1895", street="Breitscheidplatz", zip="10789",
    lat=52.504722, lng=13.335000, radius=80, ink="4A5A7A", cls=["architecture", "heritage", "memorial", "free"], tier="free",
    desc="The bombed stump of a 19th-century church tower on Breitscheidplatz, kept as a ruin, with a modern octagonal church beside it. See the mosaics in the old tower's memorial hall, then step into the new church, lit by thousands of small blue glass panes. Plan 30 minutes.",
    facts=["Berliners nicknamed the broken tower the hollow tooth.",
           "Egon Eiermann's new church of 1961 has walls of more than 20,000 blue glass inlays made in Chartres."],
    good="Free; donations welcome. The memorial hall in the old tower has shorter hours than the new church. Zoologischer Garten and Kurfürstendamm stations are close by.",
    prompt="Sit in the blue church for a few minutes, then look back at the ruin. Why do you think Berlin kept the damaged tower instead of rebuilding it?",
    obj="Explain why the bombed tower was preserved as a memorial against war beside a new church.",
    stamp=("arch", "ruintower", "GEDÄCHTNIS", "KIRCHE"))

stop(slug="kadewe", name="KaDeWe", year="1907", street="Tauentzienstraße 21-24", zip="10789",
    lat=52.501600, lng=13.341200, radius=70, ink="7A5A3A", cls=["shopping", "food_drink", "heritage"], tier="15_to_50",
    desc="Kaufhaus des Westens, Berlin's grand department store on Wittenbergplatz, and in Cold War years a showcase of West Berlin plenty. Go straight up to the food hall on the sixth floor, walk the counters of cheese, sausage and chocolate, and sit at a bar for a snack. Plan an hour.",
    facts=["The store opened in 1907 and is one of the largest department stores in Europe.",
           "A US bomber crashed into the building in 1943, and it reopened only in 1950."],
    good="Closed on Sundays, like most shops in Germany. The food hall bars are pricier than the city's street food. Wittenbergplatz station is at the door.",
    prompt="Pick one counter you have never seen at home. What did you try, and would you bring it back?",
    obj="Describe the role KaDeWe played as a symbol of West Berlin prosperity during the Cold War.",
    stamp=("rect", "store", "KADEWE", "BERLIN"))

stop(slug="charlottenburg-palace", name="Charlottenburg Palace", year="1699", street="Spandauer Damm 10-22", zip="14059",
    lat=52.520900, lng=13.295800, radius=150, ink="6E7A44", cls=["architecture", "heritage", "garden"], tier="15_to_50",
    desc="The largest royal palace in Berlin, a long baroque front under a green dome, with formal gardens running down to the Spree. Tour the Old Palace and the porcelain cabinet, then walk the gardens to the lake and the Belvedere tea house. Plan two to three hours.",
    facts=["It began as a summer house for Sophie Charlotte, the first queen of Prussia, and was named for her after her death in 1705.",
           "The palace was heavily bombed in 1943 and rebuilt after the war."],
    good="Paid entry, closed on Mondays. The palace gardens are free and open daily. Bus M45 and 309 stop at Luisenplatz.",
    prompt="Walk from the palace to the lake. What would the queen have seen from her windows here around 1700?",
    obj="Describe how Charlottenburg Palace grew from a queen's summer house into a royal residence of Prussia.",
    stamp=("circle", "palacedome", "CHARLOTTEN", "BURG"))

stop(slug="berlin-zoo", name="Berlin Zoo Elephant Gate", year="1844", street="Budapester Straße 34", zip="10787",
    lat=52.505800, lng=13.337000, radius=80, ink="5A6A3E", cls=["family", "outdoor", "animals"], tier="15_to_50",
    desc="Germany's oldest zoo, entered on Budapester Straße through a pagoda-roofed gate carried by two stone elephants. Go in through the Elephant Gate, then visit the aquarium building next door, or simply walk the paths beside the Landwehr Canal. Plan two to three hours.",
    facts=["The Berlin Zoo opened in 1844 on land given by King Frederick William IV.",
           "The Elephant Gate was first built in 1899 and reconstructed after the war."],
    good="Paid entry; combined tickets with the aquarium are sold. Opening times change with the season. Zoologischer Garten station is a few minutes' walk.",
    prompt="Look at the two stone elephants holding up the gate. Why do you think an 1890s zoo chose an Asian design for its door?",
    obj="Describe how the Berlin Zoo reflects 19th-century interest in faraway places through its architecture.",
    stamp=("arch", "elephants", "ZOO", "BERLIN"))

# ---------- Page 6 ----------
stop(slug="sanssouci", name="Sanssouci Palace", year="1747", street="Maulbeerallee", zip="14469",
    lat=52.404700, lng=13.038500, radius=150, ink="9A7A3A", cls=["architecture", "heritage", "garden", "daytrip"], tier="15_to_50",
    desc="Frederick the Great's one-storey summer palace on top of terraced vineyards in Potsdam. Climb the six terraces from the fountain, tour the palace rooms on a timed ticket, and find the king's simple grave beside the palace. Plan half a day for the park.",
    facts=["The name means without worry in French, the language Frederick preferred.",
           "Visitors leave potatoes on Frederick's grave because he promoted potato growing in Prussia."],
    good="Timed tickets are needed for the palace, which is closed on Mondays. The park is free. From Berlin take the S7 or a regional train to Potsdam Hauptbahnhof, then bus 695.",
    prompt="Stand at the top of the terraces and look back over the vines. Why do you think a king wanted a small palace here, away from Berlin?",
    obj="Explain how Sanssouci reflects Frederick the Great's taste and his wish to escape court life.",
    stamp=("oval", "terraces", "SANSSOUCI", "POTSDAM"))

stop(slug="cecilienhof", name="Cecilienhof Palace", year="1917", street="Im Neuen Garten 11", zip="14469",
    lat=52.419400, lng=13.070800, radius=120, ink="6A4A3A", cls=["heritage", "architecture", "daytrip", "museum"], tier="15_to_50",
    desc="A large country house in the English Tudor style in Potsdam's New Garden, where the Allied leaders met in 1945. See the conference room with its round table, and the red star of flowers that the Soviets planted in the courtyard. Plan 90 minutes.",
    facts=["It was the last palace built by the Hohenzollerns, finished in 1917 for Crown Prince Wilhelm and Crown Princess Cecilie.",
           "Truman, Churchill (later Attlee) and Stalin met here in July and August 1945 for the Potsdam Conference."],
    good="Paid entry, closed on Mondays. Bus 603 from Potsdam Hauptbahnhof stops nearby. The New Garden around it is free.",
    prompt="Stand by the round conference table. What do you think was the hardest thing these three men had to agree on?",
    obj="Describe what the Allied leaders decided about post-war Germany at the 1945 Potsdam Conference.",
    stamp=("rect", "tudorhouse", "CECILIENHOF", "1945"))

stop(slug="glienicke-bridge", name="Glienicke Bridge", year="1907", street="Königstraße", zip="14109",
    lat=52.413500, lng=13.090300, radius=120, ink="4A6A6A", cls=["heritage", "free", "outdoor", "daytrip"], tier="free",
    desc="The steel bridge over the Havel between Berlin and Potsdam, closed during the Cold War and used three times to swap spies. Walk across the middle of the bridge, where a line marks the old border, and read the panels on the Berlin side. Plan 30 minutes.",
    facts=["In 1962 the US pilot Francis Gary Powers was exchanged here for the Soviet spy Rudolf Abel.",
           "The paint changes shade at the middle, because East and West each painted only their own half."],
    good="Free and open at all hours. Tram 93 from Potsdam stops at the Potsdam end of the bridge; bus 316 runs on the Berlin side.",
    prompt="Stand on the line in the middle of the bridge. What would it have taken to walk across it in 1962?",
    obj="Explain why Glienicke Bridge became known as the bridge of spies during the Cold War.",
    stamp=("rect", "steelbridge", "GLIENICKE", "BRIDGE"))

stop(slug="dutch-quarter", name="Dutch Quarter, Potsdam", year="1742", street="Mittelstraße", zip="14467",
    lat=52.403900, lng=13.059900, radius=150, ink="9A4A32", cls=["architecture", "heritage", "free", "shopping"], tier="free",
    desc="Four blocks of red-brick gabled houses built for Dutch craftsmen invited to Potsdam by King Frederick William I. Walk Mittelstraße and Benkertstraße, look at the gables and white shutters, and stop at a café in one of the courtyards. Plan an hour.",
    facts=["The quarter has 134 red-brick houses built between 1733 and 1742.",
           "Fewer Dutch settlers came than the king hoped, so many of the houses went to soldiers and other families."],
    good="Free to walk at all hours; shops and cafés keep normal hours and many close on Sundays. It is a 15-minute walk from Sanssouci park.",
    prompt="Pick one gable and sketch its shape in your journal. What makes this street feel different from the rest of Potsdam?",
    obj="Describe why Frederick William I invited Dutch craftsmen to Potsdam and how their houses still shape the town.",
    stamp=("rect", "gables", "DUTCH QUARTER", "POTSDAM"))

# ---------- Page 7: Berlin Eats ----------
stop(slug="curry-36", name="Curry 36", year="1980", street="Mehringdamm 36", zip="10961",
    lat=52.493610, lng=13.387940, radius=40, ink="A0402E", cls=["food_drink", "quirky"], tier="5_to_15",
    desc="A busy currywurst stand on Mehringdamm in Kreuzberg, open from morning until late. Order currywurst with or without skin, with fries, and eat it standing at the counters outside with the U-Bahn rumbling below. Plan 20 minutes.",
    facts=["Currywurst was first sold in Berlin in 1949 by Herta Heuwer, who mixed ketchup and curry powder.",
           "West Berliners make it with sausage in skin or without; East Berliners traditionally ate it without skin."],
    diet="Pork sausage, with chicken and vegan sausages also offered. Fries are fried in shared oil. Ask about gluten in the sausages.",
    price="€ (about 5 to 10 euros)",
    good="Open daily from morning to late at night. Queues move quickly. Mehringdamm station (U6 and U7) is at the corner.",
    prompt="Order your currywurst the way the person in front of you did. How spicy did you go, and would you change it next time?",
    obj="Describe how currywurst became Berlin's best-known street food after the Second World War.",
    stamp=("circle", "currywurst", "CURRYWURST", "KREUZBERG"))

stop(slug="mustafas", name="Mustafa's Gemüse Kebap", year="1996", street="Mehringdamm 32", zip="10961",
    lat=52.493860, lng=13.388120, radius=40, ink="7A6A2E", cls=["food_drink", "quirky"], tier="5_to_15",
    desc="The kebab shop famous for its queue, serving chicken döner piled with roasted vegetables, feta and a squeeze of lemon. Join the line, order a Gemüse Kebap or the vegetarian version, and eat it on Mehringdamm. Plan 30 to 90 minutes with the queue.",
    facts=["The shop started as a small kiosk at the U-Bahn exit, which burned down years ago; it moved to a shop across the road.",
           "Its döner is made with chicken, grilled potatoes, peppers, zucchini and carrots, a style other Berlin shops now copy."],
    diet="Chicken, with a vegetarian version. Halal. Contains wheat bread and dairy (feta and sauces).",
    price="€ (about 6 to 9 euros)",
    good="Open daily, usually from 10am to 2am. The queue is shortest in the late morning on weekdays. Mehringdamm station is next door.",
    prompt="While you wait, count how many people are ahead of you. Was it worth the queue, and what made it different from other döner you have had?",
    obj="Explain how Turkish immigrants in Berlin created the modern döner kebab as a street food.",
    stamp=("circle", "kebab", "GEMÜSE", "KEBAP"))

stop(slug="konnopkes", name="Konnopke's Imbiss", year="1930", street="Schönhauser Allee 44b", zip="10435",
    lat=52.540656, lng=13.412189, radius=40, ink="8A4A2E", cls=["food_drink", "heritage"], tier="5_to_15",
    desc="A sausage stand under the elevated U2 tracks at Eberswalder Straße in Prenzlauer Berg, run by the same family since 1930. Order a currywurst without skin, the East Berlin way, and eat it at the standing tables as trains pass overhead. Plan 20 minutes.",
    facts=["Max Konnopke started selling sausages here in 1930.",
           "It is said to have been the first stand in East Berlin to sell currywurst, in the 1960s."],
    diet="Pork sausage, with a vegan option. Fries are fried in shared oil.",
    price="€ (about 4 to 8 euros)",
    good="Open Monday to Friday 10am to 8pm and Saturday from 11:30am, closed on Sundays. Eberswalder Straße station (U2) is directly above.",
    prompt="Eat under the tracks and time the gap between two trains. What does this stand tell you about the old East Berlin?",
    obj="Compare East and West Berlin styles of currywurst at a stand that has served it since the Cold War.",
    stamp=("rect", "tracks", "KONNOPKE", "SEIT 1930"))

stop(slug="markthalle-neun", name="Markthalle Neun", year="1891", street="Eisenbahnstraße 42-43", zip="10997",
    lat=52.502100, lng=13.431600, radius=50, ink="6A5A2E", cls=["food_drink", "architecture", "heritage"], tier="15_to_50",
    desc="A brick and iron market hall in Kreuzberg, one of the city's 14 original covered markets, now full of local food stalls, a bakery and a brewery. Walk the stalls, try a local cheese or a slice of cake, and come back on Thursday evening for the street food market. Plan an hour.",
    facts=["Berlin built 14 covered market halls in the 1880s and 1890s to move food selling off the streets.",
           "Local residents fought to keep the hall as a market, and it reopened in its current form in 2011."],
    diet="Many stalls with meat, vegetarian and vegan options. Ask each stall about allergens.",
    price="€€ (about 10 to 25 euros)",
    good="Open Monday to Saturday, closed on Sundays; Street Food Thursday runs in the evenings. Görlitzer Bahnhof station (U1) is a few minutes' walk.",
    prompt="Buy one thing from a stall whose owner you can talk to. What did they tell you about where it comes from?",
    obj="Describe how Berlin's 19th-century market halls were built and how Markthalle Neun was revived.",
    stamp=("arch", "markethall", "MARKTHALLE", "NEUN"))

# ---------- Info pages ----------
INFO = [
    ("Know Before You Go: Laws & Money", [
        ("Entry and paperwork", "US citizens can stay up to 90 days in any 180 in Germany and the Schengen area without a visa. Your passport must be under 10 years old and valid 3 months past departure. Since April 2026 the EU Entry/Exit System scans fingerprints and a photo instead of stamping passports."),
        ("ETIAS not yet", "The EU travel authorization, ETIAS, is not running yet, so you do not need it for a trip in late 2026. A launch now looks likely in 2027, and the EU says it will give several months' notice."),
        ("Cash still matters", "Germany uses the euro. Cards work in most places now, but small bakeries, sausage stands and some bars still take cash only, so carry 30 to 50 euros. Prices include VAT (19% on most goods). Ask for a tax-free form when you shop and get it stamped at customs before you fly home."),
        ("Tickets and fines", "Buy and validate your U-Bahn, S-Bahn, tram and bus ticket before you ride; plain-clothes inspectors fine riders without one 60 euros. An AB ticket covers central Berlin, and you need ABC for Potsdam. The Deutschlandticket, 63 euros a month in 2026, covers all local transport in Germany."),
        ("Red lights and bike lanes", "Wait for the green walking man even if the street is empty; jaywalking can bring a fine and disapproving looks. Stay out of the red or marked bike lanes on sidewalks, because cyclists ride fast and expect them clear."),
    ]),
    ("Know Before You Go: Customs", [
        ("Sundays are quiet", "Most shops and supermarkets close on Sundays and public holidays. Shops in big train stations stay open. Plan groceries for Saturday, and keep noise down on Sundays and after 10pm, called quiet time."),
        ("Tipping", "Service is included, but rounding up or adding 5 to 10% is normal at a sit-down meal. Tell the server the total you want to pay as you hand over the money, rather than leaving coins on the table."),
        ("Pfand: bottle deposits", "Most bottles and cans carry a deposit of 8 to 25 cents. Return them to the machines in any supermarket for a receipt you can spend. Many Berliners leave empties beside public bins for collectors."),
        ("Greetings and manners", "Say Guten Tag or Hallo when you walk into a small shop, and Tschüss when you leave. Use Sie, the formal you, with strangers. Germans are direct and punctual; arrive on time for tours and reservations."),
        ("History with care", "Nazi symbols and the Hitler salute are crimes in Germany, even as a joke. At memorials, be quiet and respectful; do not sit, climb or take playful photos at the Holocaust Memorial or the Wall Memorial."),
    ]),
    ("German Phrases: The Basics", "PHRASES_DE_1"),
    ("German Phrases: Out and About", "PHRASES_DE_2"),
]

COVER = dict(front="ber_front", back="ber_back", word="BERLIN")
