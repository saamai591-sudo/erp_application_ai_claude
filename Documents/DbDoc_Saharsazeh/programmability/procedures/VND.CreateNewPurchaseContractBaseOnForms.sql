---------------------------------------------------------

CREATE   PROCEDURE [VND].CreateNewPurchaseContractBaseOnForms
(
	@entityId INT,
	@engName NVARCHAR(255)
)
--WITH ENCRYPTION
AS
BEGIN
	DECLARE @currencyId INT,
			@dlId INT;

	IF @engName = 'ProposalCommission'
	BEGIN
		SELECT            
			cast(a.RowIndex as smallint) [RowIndex]
		   ,a.ProposalItemID
		   ,b.[StuffID]
		   ,[MainQuantity]
		   ,[SubQuantity]
		   ,d.Number ProposalItemNumber
		   ,c.Title StuffTitle
		   ,c.code StuffCode
		   ,b.Fee
		   ,b.Price
		   ,b.Discount
		   ,b.Tax
		   ,b.Duty
		   ,b.Price - b.Discount CostOfBuying
		   ,b.Price - b.Discount + b.Tax + b.Duty Net
		   ,p.DlID
		   ,d.CurrencyID
		INTO #items
		FROM vnd.ProposalCommissionItem  a
		join vnd.ProposalItem b on a.ProposalItemID = b.ProposalItemID
		join stf.VWStuff c on c.StuffID = b.StuffID
		join vnd.Proposal d on d.ProposalID = b.ProposalID
		join cfg.Party p on p.PartyID = d.PartyID
		where a.ProposalCommissionID = @entityId
		and Chosen = 1
		
		SELECT @currencyId = CASE 
								WHEN COUNT(DISTINCT CurrencyID) = 1 
										THEN MIN(CurrencyID) 
								ELSE NULL 
							 END
		FROM #items;	
		SELECT @dlId = CASE 
								WHEN COUNT(DISTINCT DlID) = 1 
										THEN MIN(DlID) 
								ELSE NULL 
							 END
		FROM #items;	

		--Header
		SELECT 
			BranchID, 
			-1 as PurchaseContractID,
			a.Date as Date,
			CAST(5 AS TINYINT) AS BaseType,
			@currencyId CurrencyID,
			@dlId DlID
		FROM VND.ProposalCommission a
		WHERE a.ProposalCommissionID = @entityId;

		-- Items
		SELECT CAST(-1 * i.RowIndex AS INT) AS PurchaseContractItemID , 
			   -1 as PurchaseContractID,
			   i.ProposalItemNumber,
			   i.ProposalItemID,
			   i.RowIndex,
			   i.StuffID,
			   i.StuffTitle,
			   i.StuffCode,
			   i.MainQuantity,
			   i.SubQuantity,
			   i.Fee,
			   i.Price,
			   i.Discount,
			   i.Tax,
			   i.Duty,
			   i.CostOfBuying,
			   i.Net,
			   cast(0 as bit) IsNotInFlow,
			   DlID
		FROM #items AS i;

	END;
END;
