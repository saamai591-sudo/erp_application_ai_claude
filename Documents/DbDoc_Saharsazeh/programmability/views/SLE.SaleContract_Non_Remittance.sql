CREATE VIEW [SLE].[SaleContract_Non_Remittance]
AS
    SELECT  sci2.SaleContractItemID ,
            sci2.MainQuantity ,
            sci2.SubQuantity ,
            T.DoMainQuantity ,
            T.DoSubQuantity ,
            CASE WHEN s.[Type] = 1
                      OR MainQuantity < DoMainQuantity THEN 0
                 ELSE MainQuantity - DoMainQuantity
            END AS Non ,
            CASE WHEN s.[Type] = 1
                      OR SubQuantity < DoSubQuantity THEN 0
                 ELSE SubQuantity - DoSubQuantity
            END AS SubNon
    FROM    ( SELECT    sci.SaleContractItemID ,
                        ISNULL(fl.MainQuantity, 0) AS DoMainQuantity ,
                        ISNULL(fl.SubQuantity, 0) AS DoSubQuantity
              FROM      SLE.SaleContractItem AS sci
                        LEFT JOIN ( SELECT  ii2.SaleContractItemID ,
                                            SUM(ii2.MainQuantity) MainQuantity ,
                                            SUM(ii2.SubQuantity) SubQuantity
                                    FROM    SLE.RemittanceItem AS ii2
                                    GROUP BY ii2.SaleContractItemID
                                  ) fl ON fl.SaleContractItemID = sci.SaleContractItemID
            ) T
            INNER JOIN SLE.SaleContractItem AS sci2 ON sci2.SaleContractItemID = T.SaleContractItemID
            INNER JOIN STF.[Stuff] AS s ON s.StuffID = sci2.StuffID;


