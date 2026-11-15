
--------------------------------------------------------------------
CREATE   VIEW CNT.vwContractSubject_Stuff_Non
as
SELECT cs.ContractSubjectID,
       cs.StuffID,
       cs.ContractPartyID,
	   cs.PartyDlID,
       cs.Quantity ,
       ISNULL(Pur.PurchasedQuantity, 0) + ISNULL(sr.ReceiptQuantity, 0) + ISNULL(tsr.ReceiptQuantity, 0) AS Done,
       cs.Quantity -(
           ISNULL(Pur.PurchasedQuantity, 0) + ISNULL(sr.ReceiptQuantity, 0) + ISNULL(tsr.ReceiptQuantity, 0)
       )                    AS Non,
       CAST(CASE WHEN cs.[Type] IN (3,4) then 1 else 0 end as BIT ) FeeChangeble,
       CAST(CASE WHEN cs.[Type] IN (2,4) then 1 else 0 end as BIT) QuantityIncreasable
FROM   cnt.VWContractSubject  AS cs
       left JOIN (
                SELECT pii.ContractSubjectID,
                       SUM(pii.MainQuantity) PurchasedQuantity
                FROM   vnd.PurchaseInvoiceItem AS pii
                WHERE  pii.ContractSubjectID is NOT NULL
                GROUP BY
                       pii.ContractSubjectID
            ) Pur           ON  Pur.ContractSubjectID = cs.ContractSubjectID
       left JOIN (
                SELECT sri.ContractSubjectID,
                       SUM(sri.MainQuantity) ReceiptQuantity
                FROM   stc.StockReceiptItem AS sri
                WHERE  sri.ContractSubjectID is NOT NULL
                GROUP BY
                       sri.ContractSubjectID
            ) sr            ON  sr.ContractSubjectID = cs.ContractSubjectID
       left JOIN (
                SELECT sri.ContractSubjectID,
                       SUM(sri.MainQuantity) ReceiptQuantity
                FROM   stc.TemporaryStockReceiptItem AS sri
                WHERE  sri.ContractSubjectID is NOT NULL
                GROUP BY
                       sri.ContractSubjectID
            ) tsr         ON  tsr.ContractSubjectID = cs.ContractSubjectID

			where cs.StuffID is not null
