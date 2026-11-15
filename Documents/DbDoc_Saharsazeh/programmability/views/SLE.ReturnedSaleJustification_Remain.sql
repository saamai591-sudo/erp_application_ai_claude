
----------------------------------------------------------
CREATE   VIEW [SLE].ReturnedSaleJustification_Remain
AS
SELECT rsji.ReturnedSaleJustificationItemID,
	rsji.MainQuantity,
	rsji.Price,
	rsji.Discount,
	ji.MainQuantity DoMainQuantity,
	ji.SubQuantity DoSubQuantity,
	ji.Price DoPrice,
	ji.Discount DoDiscount,
	rsji.MainQuantity - ISNULL(ji.MainQuantity, 0) AS Non,
	rsji.SubQuantity - ISNULL(ji.SubQuantity, 0) AS NonSub,
	rsji.Price - ISNULL(ji.Price, 0) AS NonPrice,
	rsji.Discount - ISNULL(ji.Discount, 0) AS NonDiscount
FROM sle.ReturnedSaleJustificationItem AS rsji
LEFT JOIN (
	SELECT ReturnedSaleJustificationItemID,
		SUM(MainQuantity) AS MainQuantity,
		SUM(SubQuantity) AS SubQuantity,
		SUM(Price) AS Price,
		SUM(Discount) AS Discount
	FROM (
		SELECT ReturnedSaleJustificationItemID,
			MainQuantity,
			SubQuantity,
			Price,
			Discount
		FROM SLE.ReturnedSaleInvoiceItem AS oi
		
		UNION ALL
		
		SELECT ReturnedSaleJustificationItemID,
			MainQuantity,
			SubQuantity,
			Price,
			0 AS Discount
		FROM STC.ReturnedOutgoingItem AS roi
		) AS af
	GROUP BY ReturnedSaleJustificationItemID
	) ji
	ON ji.ReturnedSaleJustificationItemID = rsji.ReturnedSaleJustificationItemID;
