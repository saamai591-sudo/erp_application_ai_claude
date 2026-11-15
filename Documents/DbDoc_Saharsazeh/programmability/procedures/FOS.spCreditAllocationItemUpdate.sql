---------------------------------------------------------------------------------
CREATE   PROC [FOS].[spCreditAllocationItemUpdate] 
	@CreditAllocationItemID int,
	@CreditAllocationID int,
	@PurchaseInvoiceID int,
	@ConfirmStatementID int,
	@ConfirmStatementItemID int,
	@ContractStatementID int,
	@Amount decimal(30, 4),
	@CurrencyRate decimal(20, 10),
	@LastEditor int,
	@LastEditionDate datetime,
	@Version int,
	@ConfirmPurchaseInvoiceID INT = NULL,
	@ConfirmPurchaseInvoiceItemID INT = NULL
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 

	if @Version=(Select [Version] from [FOS].CreditAllocationItem
	where CreditAllocationItemID = @CreditAllocationItemID)
	begin	

		set @Version = @Version +1 

		UPDATE [FOS].CreditAllocationItem
		SET     [CreditAllocationID] = @CreditAllocationID, 
				[PurchaseInvoiceID] = @PurchaseInvoiceID,
				[ConfirmStatementID] = @ConfirmStatementID, 
				[ConfirmStatementItemID] = @ConfirmStatementItemID, 
				[ContractStatementID] = @ContractStatementID, 
				[Amount] = @Amount, 
				[CurrencyRate] = @CurrencyRate, 
				[LastEditor] = @LastEditor, 
				[LastEditionDate] = @LastEditionDate, 
				[Version] = @Version,
				[ConfirmPurchaseInvoiceID] = @ConfirmPurchaseInvoiceID,
				[ConfirmPurchaseInvoiceItemID] = @ConfirmPurchaseInvoiceItemID
		WHERE  CreditAllocationItemID = @CreditAllocationItemID
	
		-- Begin Return Select <- do not remove
		SELECT [Version]
		FROM   [FOS].CreditAllocationItem
		WHERE  CreditAllocationItemID = @CreditAllocationItemID
		-- End Return Select <- do not remove

		DECLARE @Remain decimal(30, 4), @Number nvarchar(250), @Message NVARCHAR(MAX)

	IF (@PurchaseInvoiceID IS NOT NULL)
	BEGIN
	
		SELECT @Remain = pa.NonPaymented,
			   @Number = p.Number 
		FROM VND.PurchaseInvoice p
		join VND.PurchaseInvoice_NonPaymented pa on p.PurchaseInvoiceID = pa.PurchaseInvoiceID
		WHERE p.PurchaseInvoiceID = @PurchaseInvoiceID
	
		IF (@Remain < 0)	
		BEGIN
			SELECT @Message = lsv.[Value]
			FROM cfg.LocalizationSQLMessage ls
			JOIN cfg.LocalizationSQLMessageValue lsv 
			ON lsv.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
			WHERE ls.SQLMessageCode = 'PurchaseInvoiceDocumentRemainWillBeNegative'
			AND lsv.Culture = cfg.GetuserCulture()
			
			SET @Message= REPLACE(@Message, '{0}', @Number)
			RAISERROR(@Message,16,12)
			return
		END
	
	END

	IF (@ConfirmStatementID IS NOT NULL)
	BEGIN
	
		SELECT @Remain = vw.Remain,
			   @Number = c.Number 
		FROM CNT.ConfirmStatement cs
		join CNT.[Contract] c on cs.ContractID = c.ContractID
		join CNT.vwConfirmStatementRemain vw on cs.ConfirmStatementID = vw.ConfirmStatementID
		WHERE cs.ConfirmStatementID = @ConfirmStatementID
	
		IF (@Remain < 0)	
		BEGIN
			SELECT @Message = lsv.[Value]
			FROM cfg.LocalizationSQLMessage ls
			JOIN cfg.LocalizationSQLMessageValue lsv 
			ON lsv.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
			WHERE ls.SQLMessageCode = 'ConfirmStatementDocumentRemainWillBeNegative'
			AND lsv.Culture = cfg.GetuserCulture()
			
			SET @Message= REPLACE(@Message, '{0}', @Number)
			RAISERROR(@Message,16,12)
			return
		END
	
	END

	IF (@ConfirmStatementItemID IS NOT NULL)
	BEGIN
	
		SELECT @Remain = vw.Remain,
			   @Number = c.Number 
		FROM CNT.ConfirmStatementItem csi
		join CNT.ConfirmStatement cs on csi.ConfirmStatementID = cs.ConfirmStatementID
		join CNT.[Contract] c on cs.ContractID = c.ContractID
		join CNT.vwConfirmStatementItemRemain vw on csi.ConfirmStatementItemID = vw.ConfirmStatementItemID
		WHERE csi.ConfirmStatementItemID = @ConfirmStatementItemID
	
		IF (@Remain < 0)	
		BEGIN
			SELECT @Message = lsv.[Value]
			FROM cfg.LocalizationSQLMessage ls
			JOIN cfg.LocalizationSQLMessageValue lsv 
			ON lsv.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
			WHERE ls.SQLMessageCode = 'ConfirmStatementItemDocumentRemainWillBeNegative'
			AND lsv.Culture = cfg.GetuserCulture()
			
			SET @Message= REPLACE(@Message, '{0}', @Number)
			RAISERROR(@Message,16,12)
			return
		END
	
	END

	IF (@ContractStatementID IS NOT NULL)
	BEGIN
	
		SELECT @Remain = vw.VatRemain,
			   @Number = c.Number 
		FROM CNT.ContractStatement cs
		join CNT.[Contract] c on cs.ContractID = c.ContractID
		join CNT.vwContractStatementRemain vw on cs.ContractStatementID = vw.ContractStatementID
		WHERE cs.ContractStatementID = @ContractStatementID
	
		IF (@Remain < 0)	
		BEGIN
			SELECT @Message = lsv.[Value]
			FROM cfg.LocalizationSQLMessage ls
			JOIN cfg.LocalizationSQLMessageValue lsv 
			ON lsv.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
			WHERE ls.SQLMessageCode = 'ContractStatementDocumentRemainWillBeNegative'
			AND lsv.Culture = cfg.GetuserCulture()
			
			SET @Message= REPLACE(@Message, '{0}', @Number)
			RAISERROR(@Message,16,12)
			return
		END
	
	END

	end 
ELSE 
	RAISERROR('Version mismatch...', 16 , 10)
