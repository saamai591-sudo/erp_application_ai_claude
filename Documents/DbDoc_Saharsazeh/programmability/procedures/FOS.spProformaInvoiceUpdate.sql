CREATE PROC [FOS].[spProformaInvoiceUpdate] 
    @ProformaInvoiceID int,
    @BranchID int,
    @Base tinyint,
    @Number nvarchar(100),
    @Date date,
	@CreditDate date,
    @Vendor bigint,
    @CurrencyID int,
    @DLID bigint,
    @Status tinyint,
	@ParentID int,
	@LastEditor int,
    @LastEditionDate datetime,
    @Version int
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 


	if @Version=(Select [Version] from [FOS].[ProformaInvoice]
	where [ProformaInvoiceID] = @ProformaInvoiceID)
	begin	

		set @Version = @Version +1 

		UPDATE [FOS].[ProformaInvoice]
		SET     [BranchID] = @BranchID, 
				[Base] = @Base, 
				[Number] = @Number, 
				[Date] = @Date, 
				[CreditDate] = @CreditDate,
				[Vendor] = @Vendor, 
				[CurrencyID] = @CurrencyID, 
				[DLID] = @DLID, 
				[Status] = @Status, 
				[ParentID] = @ParentID,
				[LastEditor] = @LastEditor, 
				[LastEditionDate] = @LastEditionDate, 
				[Version] = @Version
		WHERE  [ProformaInvoiceID] = @ProformaInvoiceID
	
		-- Begin Return Select <- do not remove
		SELECT [Version]
		FROM   [FOS].[ProformaInvoice]
		WHERE  [ProformaInvoiceID] = @ProformaInvoiceID	
		-- End Return Select <- do not remove

	end 
	ELSE 
		RAISERROR('Version mismatch...', 16 , 10)
