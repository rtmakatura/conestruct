# src/export

Device list exporter. Converts a device layout into an Excel spreadsheet with
CDOT Section 630 pay item codes, units, descriptions, and quantities. Handles
special quantity rules like CHANNELIZER_OPTIONAL probability weighting. Output
is an .xlsx file generated with openpyxl.
