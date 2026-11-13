"""Phrase pages. Each section: heading, list of (english, local, pronunciation). Numbers section is a list of lines.
German only here; the Swedish pages (SV_1, SV_2) are in the project doc for when Stockholm gets its content file.
"""

DE_1 = [
    ("Hello and goodbye", [("Hello", "Hallo", "HAH-loh"), ("Good day", "Guten Tag", "GOO-ten tahk"),
                           ("Good evening", "Guten Abend", "GOO-ten AH-bent"), ("Bye", "Tschüss", "chewss")]),
    ("Polite words", [("Please", "Bitte", "BIT-uh"), ("Thank you", "Danke", "DAHN-kuh"),
                      ("You're welcome", "Gern geschehen", "gairn guh-SHAY-en"), ("Excuse me", "Entschuldigung", "ent-SHOOL-dee-goong")]),
    ("When you're stuck", [("Sorry", "Es tut mir leid", "es toot meer lite"), ("I don't understand", "Ich verstehe nicht", "ikh fer-SHTAY-uh nikht"),
                           ("Do you speak English?", "Sprechen Sie Englisch?", "SHPREKH-en zee ENG-lish"), ("More slowly, please", "Langsamer, bitte", "LAHNG-zah-mer BIT-uh")]),
    ("Small talk", [("Yes / No", "Ja / Nein", "yah / nine"), ("Fine, thanks", "Gut, danke", "goot DAHN-kuh"),
                    ("Nice to meet you", "Freut mich", "froyt mikh"), ("See you later", "Bis später", "biss SHPAY-ter")]),
    ("Numbers", ["1 eins (ines) · 2 zwei (tsvy) · 3 drei (dry) · 4 vier (feer)",
                 "5 fünf (fewnf) · 6 sechs (zeks) · 7 sieben (ZEE-ben)",
                 "8 acht (ahkht) · 9 neun (noyn) · 10 zehn (tsayn)",
                 "100 hundert (HOON-dert) · 1,000 tausend (TOW-zent) · 1,000,000 eine Million (INE-uh mil-YOHN)"]),
]

DE_2 = [
    ("Restroom and water", [("Where is the restroom?", "Wo ist die Toilette?", "voh ist dee twah-LET-uh"), ("Men / Women", "Herren / Damen", "HAIR-en / DAH-men"),
                            ("Tap water, please", "Leitungswasser, bitte", "LIE-toongs-vah-ser BIT-uh"), ("Still / sparkling", "still / mit Kohlensäure", "shtill / mit KOH-len-zoy-ruh")]),
    ("Eating out", [("A table for two", "Einen Tisch für zwei", "INE-en tish fewr tsvy"), ("The menu, please", "Die Speisekarte, bitte", "dee SHPY-zuh-kar-tuh BIT-uh"),
                    ("The bill, please", "Die Rechnung, bitte", "dee REKH-noong BIT-uh"), ("Cheers!", "Prost!", "prohst")]),
    ("Getting around", [("Where is...?", "Wo ist...?", "voh ist"), ("The train station", "Der Bahnhof", "dair BAHN-hohf"),
                        ("A ticket to...", "Eine Fahrkarte nach...", "INE-uh FAR-kar-tuh nahkh"), ("Left / Right / Straight", "Links / Rechts / Geradeaus", "links / rekhts / guh-RAH-duh-ows")]),
    ("Shopping", [("How much is it?", "Was kostet das?", "vahs KOS-tet dahs"), ("Can I pay by card?", "Kann ich mit Karte zahlen?", "kahn ikh mit KAR-tuh TSAH-len"),
                  ("Only cash?", "Nur bar?", "noor bar"), ("Just looking", "Ich schaue nur", "ikh SHOW-uh noor")]),
    ("Help", [("Help!", "Hilfe!", "HIL-fuh"), ("I need a doctor", "Ich brauche einen Arzt", "ikh BROW-khuh INE-en artst"),
              ("Call the police", "Rufen Sie die Polizei", "ROO-fen zee dee poh-lee-TSY"), ("I am lost", "Ich habe mich verlaufen", "ikh HAH-buh mikh fer-LOW-fen")]),
]

PHRASES = {"PHRASES_DE_1": DE_1, "PHRASES_DE_2": DE_2}
