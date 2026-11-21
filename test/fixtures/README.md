# Test fixtures

Hand-made. They are not real SATCAT rows, apart from the GPZ rows, which are cut from `data/raw/2026-11-20/`.

`snapshot/` is a small snapshot set (design 7.1). `satcat.csv` is invented: objects named `FIXTURE ...` have made-up numbers. The rows for EchoStar-7, Intelsat 511, Syncom 3, TDRS 3, an Atlas Agena rocket body and an Ekran debris piece use whole-km altitudes close to the real GP orbits, but the owners, dates and status codes are made up. Syncom 3 is marked living in `satcat.csv` on purpose, so that it disagrees with the GPZ table (PAY-). Intelsat 1-F1 (1317) is in the GPZ files and not in `satcat.csv`.

`manifest.json` holds the real sha256 of each file here. Change a file, and its hash must be updated.
