
CREATE PROC [VND].[spPurchaseContractDelete] 
    @PurchaseContractID INT,@Version INT
AS 
	SET NOCOUNT ON 

	
	IF @Version=(SELECT [Version] FROM [VND].[PurchaseContract]
	WHERE [PurchaseContractID] = @PurchaseContractID)
	BEGIN	



		DELETE
		FROM   [VND].[PurchaseContract]
		WHERE  [PurchaseContractID] = @PurchaseContractID

	END
	ELSE
	BEGIN
	
	RAISERROR (N'Delete_%s_%d.', -- Message text.
		16, -- Severity,
		10, -- State,
		N'PurchaseContract', -- First argument.
		@PurchaseContractID); -- Second argument.)
	END

