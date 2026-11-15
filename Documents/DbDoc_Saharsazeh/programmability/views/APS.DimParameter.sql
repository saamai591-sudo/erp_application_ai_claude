/************************************************************
 * Code formatted by SoftTree SQL Assistant © v9.2.349
 * Time: 4/22/2018 8:41:51 AM
 ************************************************************/

CREATE VIEW [APS].[DimParameter]
AS 


SELECT p.ParameterID,
       p.Title,
       c.Title                       AS CategoryTitle,
       pt.Title                      AS ParameterTypeTitle
FROM   pay.Parameter                 AS p
       INNER JOIN PAY.Category       AS c
            ON  c.CategoryID = p.CategoryID
       INNER JOIN PAY.ParameterType  AS pt
            ON  pt.ParameterTypeID = p.ParameterTypeID

