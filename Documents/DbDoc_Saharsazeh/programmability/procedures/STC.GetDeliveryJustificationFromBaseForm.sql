------------------------------------- END #6917

------------------------------------- START #7002
CREATE   PROC [STC].GetDeliveryJustificationFromBaseForm
(
    @entityId INT,
    @engName NVARCHAR(MAX)
)
--WITH ENCRYPTION
AS
BEGIN
    
    DECLARE @Culture NVARCHAR(5),	
            @CultureNo TINYINT,
			@Number INT;

    SET @Culture = CFG.GetuserCulture();

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;

	SELECT @Number = MAX(Number) + 1 from VND.DeliveryJustification


	IF @engName = 'PurchaseContract'
	BEGIN

		SELECT ROW_NUMBER() OVER (ORDER BY pci.RowIndex) AS RowIndex,
			    pci.PurchaseContractItemID,
			    pc.Number AS PurchaseContractItemNumber,
			    pcr.Non AS MainQuantity,
			    pcr.NonSub AS SubQuantity,
			    pci.StuffID,
			    CASE @CultureNo
			        WHEN 1 THEN
			            s.Title
			        WHEN 2 THEN
			            s.Title2
			    END AS StuffTitle,
			    s.Code AS StuffCode
		INTO #PurchaseContractItems

		FROM VND.PurchaseContractItem AS pci
			JOIN VND.PurchaseContract AS pc
			    ON pci.PurchaseContractID = pc.PurchaseContractID
			JOIN [VND].[PurchaseContract_Remains] AS pcr
			    ON pci.PurchaseContractItemID = pcr.PurchaseContractItemID
			JOIN STF.[VWStuff] AS s
			    ON s.StuffID = pci.StuffID
			JOIN STF.StuffDetail AS sd
			    ON sd.StuffID = s.StuffID
		WHERE pc.PurchaseContractID = @entityId
			    AND pcr.Non > 0
			    AND
			    (
			        pcr.NonSub IS NULL
			        OR pcr.NonSub > 0
			    )
		--header
		SELECT 
				-1 AS DeliveryJustificationID,				   
			    CAST(2 AS TINYINT) AS BaseType,
				@Number AS Number,
			    pc.BranchID,
				p.PartyID,
				CAST(1 AS TINYINT) AS Status,
			    GETDATE() CreationDate
		FROM VND.PurchaseContract AS pc
		JOIN acc.dl d ON pc.DlID = d.DlID	
		JOIN CFG.Party p ON p.DlID = d.DlID

		WHERE pc.PurchaseContractID = @entityId;

		-- items
		SELECT 
				CAST(-1 * t.RowIndex AS INT) AS DeliveryJustificationItemID,
				-1 AS DeliveryJustificationID,
			    CAST(t.RowIndex AS TINYINT) RowIndex,
			    t.PurchaseContractItemID,
				t.PurchaseContractItemNumber,
			    t.MainQuantity,
			    t.SubQuantity,
			    t.StuffID,
			    t.StuffTitle,
			    t.StuffCode
		FROM #PurchaseContractItems AS t;
	END;
END;
