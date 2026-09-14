[out:json][timeout:10];
(
  way(around:50,39.7269,-104.9873)["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"];
);
out geom tags;
