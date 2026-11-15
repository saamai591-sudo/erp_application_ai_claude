


CREATE   PROC CFG.spGetSeasonFileSummary
(@FinancialPeriodID INT )
as 

SELECT   sf.Season,c.CompanyID,
       sf.StartDate         FromDate,
       sf.FinishDate        ToDate,
       cfg.GetCLRSaturnDate(sf.StartDate,'yyyy/mm/dd',0,0) Date_FromDate,       
       cfg.GetCLRSaturnDate(sf.FinishDate,'yyyy/mm/dd',0,0) Date_ToDate,
       dd.SeasonName,c.Title CompanyTitle     
FROM   cfg.SeasonFile    AS sf
       JOIN cfg.Company  AS c
            ON  c.CompanyID = sf.CompanyID
            join cfg.DimDate AS dd on sf.StartDate = dd.[Date]
WHERE  sf.FinancialPeriodID = @FinancialPeriodID
GROUP BY
       c.Title,
       sf.StartDate,
       sf.FinishDate,
       sf.Season,
       dd.SeasonName,c.CompanyID

