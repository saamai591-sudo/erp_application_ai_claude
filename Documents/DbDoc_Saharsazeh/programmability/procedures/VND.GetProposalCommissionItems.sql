CREATE   PROCEDURE [VND].GetProposalCommissionItems 
@PurchasePlanningID INT
--WITH ENCRYPTION
AS
BEGIN

	DECLARE @CultureInfo VARCHAR(10),
			@CultureNo VARCHAR(10);

	SET @CultureInfo = CFG.GetuserCulture();

	SELECT @CultureNo = CultureNo
	FROM CFG.CultureInfo
	WHERE Culture = @CultureInfo;

	SELECT 0 ProposalCommissionItemID,
		   Cast(ROW_NUMBER() OVER(ORDER BY pr.PurchaseRequestID,pri.PurchaseRequestItemIndex,prp.Fee DESC) as int) AS RowIndex,
		   CASE @CultureNo
			   WHEN 2 THEN
				   ISNULL(pa.Title2, '') + ' ' + ISNULL(pa.LastName2, '')
			   ELSE
				   ISNULL(pa.Title, '') + ' ' + ISNULL(pa.LastName, '')
		   END PartyTitle,
		   CASE @CultureNo
			   WHEN 2 THEN
				   s.Title2
			   ELSE
				   s.Title
		   END StuffTitle,
		   s.code StuffCode,
		   CASE @CultureNo
			   WHEN 2 THEN
				   mu.Title2
			   ELSE
				   mu.Title
		   END MeasureUnitTitle,
		   ISNULL(p.QuotationNumber, p.Number) QuotationNumber,
		   CFG.GetSaturnDate(p.QuotationDate, 0) QuotationDateString,
		   CFG.GetSaturnDate(p.[ExpireDate], 0) ExpireDateString,
		   prp.Fee,
		   ISNULL(prp.Price, 0) Price,
		   prp.ProposalItemID,
		   prp.ProposalID,
		   prp.MainQuantity,
		   ISNULL(prp.SubQuantity, 0) SubQuantity,
		   CAST(1 AS BIT) IsNotInFlow,
		   CASE @CultureNo
			   WHEN 2 THEN
				   prp.Description2
			   ELSE
				   prp.[Description]
		   END [Description]
	FROM  VND.ProposalItem prp
		INNER JOIN VND.Proposal p
			ON prp.ProposalID = p.ProposalID
		INNER JOIN CFG.Party pa
			ON pa.PartyID = p.PartyID
		INNER JOIN STF.VWStuff s
			ON s.StuffID = prp.StuffID
		INNER JOIN STF.MeasureUnit mu
			ON mu.MeasureUnitID = s.MainMeasureUnitID
		LEFT JOIN VND.PurchasePlanningItem ppi
			ON ppi.PurchasePlanningItemID = prp.PurchasePlanningItemID
		LEFT JOIN REQ.PurchaseRequestItem pri
			ON pri.PurchaseRequestItemID = prp.PurchaseRequestItemID
		LEFT JOIN REQ.PurchaseRequest pr
			ON pr.PurchaseRequestID = pri.PurchaseRequestID
		LEFT JOIN VND.ProposalCommissionItem pci
			ON pci.ProposalItemID = prp.ProposalItemID
	WHERE ppi.PurchasePlanningID = @PurchasePlanningID
		  AND p.Status = 2
		  AND pci.ProposalItemID IS NULL
	ORDER BY pr.PurchaseRequestID,
			 pri.PurchaseRequestItemIndex,
			 prp.Fee DESC;
END;

