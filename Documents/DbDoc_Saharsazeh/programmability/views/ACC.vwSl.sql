

CREATE VIEW [ACC].[vwSl]

AS 

SELECT SlID,
       Code,
       Title,
       Title2,
       Acc.SlFullCode(acc.sl.SlID)  AS FullCode,
       Acc.SlKolId(acc.sl.SlID)     AS GLId,
       Acc.SlFullCode(Acc.SlKolId(acc.sl.SlID)) AS GLFullCode,
       Acc.SlTitle(Acc.SlKolId(acc.sl.SlID),0) AS GlTitle,
       Acc.SlTitle(Acc.SlKolId(acc.sl.SlID),1) AS GlTitle2,
       Acc.SlCode(Acc.SlKolId(acc.sl.SlID)) AS GlCode
FROM   acc.sl
WHERE  IsMoeen = 1
