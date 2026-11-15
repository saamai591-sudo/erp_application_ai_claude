



CREATE VIEW [HRM].[VwDedication]

--with encryption
AS
SELECT pd.PersonelDedicationID  AS Id,
       p.PersonelID,
       p.Code                   AS PersonelCode,
       p2.Title                 AS PersonelName,
       p2.LastName,
       CFG.GetCLRSaturnDate(pd.FromDate, N'YYYY/MM/DD', 0, 0) AS FromDate,
       CFG.GetCLRSaturnDate(pd.ToDate, N'YYYY/MM/DD', 0, 0) AS ToDate,
       pd.Amount,
       CASE pd.DedicationType
            WHEN 0 THEN N'سربازی'
            WHEN 1 THEN N'جبهه'
            WHEN 2 THEN N'بسیج فعال'
            WHEN 3 THEN N'بسیج عادی'
            WHEN 4 THEN N'جانبازی'
            WHEN 5 THEN N'ازاده'
			WHEN 6 THEN N'فرزند شهید'
			WHEN 7 THEN N'مصدوم عملیات'
       END                      AS DedicationType
FROM   HRM.PersonelDedication   AS pd
       INNER JOIN HRM.Personel  AS p
            ON  p.PersonelID = pd.PersonelID
       INNER JOIN CFG.Party     AS p2
            ON  p2.PartyID = p.PartyID




