

/************************************************************
 * Code formatted by SoftTree SQL Assistant © v9.2.349
 * Time: 10/4/2017 3:34:52 PM
 ************************************************************/

CREATE VIEW [APS].[DimSl]
AS 


SELECT s.SlID,
       s2.Title                    AS [KolTitle],
       s3.Code + s2.Code           AS [KolCode],
       s3.Title                    AS [GrouTitle],
       s3.Code                     AS [GroupCode],
       s.Title                     AS [SlTitle],
       s3.Code + s2.Code + s.Code  AS [SlCode],
       bt.Name                     AS [BalanceType],
       s.HasCurrency,
       s3.Code + s2.Code + s.Code + ' / ' + s.Title AS [FullName]
FROM   acc.SL                      AS s
       INNER JOIN acc.SL           AS s2
            ON  s2.SlID = s.ParentID
       INNER JOIN acc.SL           AS s3
            ON  s3.SlID = s2.ParentID
       INNER JOIN ACC.BalanceType  AS bt
            ON  bt.BalanceTypeID = s3.BalanceTypeID
	 

