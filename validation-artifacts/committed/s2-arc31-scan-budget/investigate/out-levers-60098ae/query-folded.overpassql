[out:json][timeout:10];
(
  node(39.716041,-104.988469,39.728271,-104.986131)["highway"="traffic_signals"];
  node(39.716041,-104.988469,39.728271,-104.986131)["highway"="crossing"];
  way(39.716041,-104.988469,39.728271,-104.986131)["highway"="footway"];
  way(39.716041,-104.988469,39.728271,-104.986131)["footway"="sidewalk"];
  way(39.716041,-104.988469,39.728271,-104.986131)["highway"="cycleway"];
  way(39.716041,-104.988469,39.728271,-104.986131)["cycleway"];
  node(39.716041,-104.988469,39.728271,-104.986131)["amenity"="school"];
  way(39.716041,-104.988469,39.728271,-104.986131)["amenity"="school"];
  node(39.716041,-104.988469,39.728271,-104.986131)["railway"="level_crossing"];
  node(39.716041,-104.988469,39.728271,-104.986131)["amenity"="hospital"];
  way(39.716041,-104.988469,39.728271,-104.986131)["amenity"="hospital"];
  node(39.716041,-104.988469,39.728271,-104.986131)["highway"="motorway_junction"];
  way(39.716041,-104.988469,39.728271,-104.986131)["highway"="motorway_link"];
  way(39.716041,-104.988469,39.728271,-104.986131)["highway"="trunk_link"];
  way(39.716041,-104.988469,39.728271,-104.986131)["bridge"="yes"];
)->.scan;
.scan out center tags;
(
  way(around:50,39.7269,-104.9873)["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"];
)->.road;
.road out geom tags;
