CREATE     PROC [CFG].[spDebitCreditNoteUpdate] 
    @DebitCreditNoteID int,
    @Number int,
    @Date date,
    @PreVoucherID int,
    @FinancialPeriodID int,
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime,
	@BranchID INT,
	@Description NVARCHAR(MAX),
	@Description2 NVARCHAR(MAX)
--WITH ENCRYPTION
AS 
BEGIN
	SET NOCOUNT ON 
	
	if @Version <>(Select [Version] from [CFG].[DebitCreditNote]
	where [DebitCreditNoteID] = @DebitCreditNoteID)
		RAISERROR('Version mismatch...', 16 , 10)

	if (select count(*) from CFG.DebitCreditNoteItem i
		join FIN.PaymentType t on i.PaymentTypeID = t.PaymentTypeID
		where i.DebitCreditNoteID = @DebitCreditNoteID and t.AnnouncedInAdditionalValue = 1) > 0
	begin

		DECLARE @maxDate DATE
		SELECT @maxDate = MAX(EndDate)
		FROM cfg.Vat v
	
		IF @maxDate IS NOT NULL
			AND @maxDate >= @Date
		BEGIN 	    
			RAISERROR('VatHasPublished', 16, 12)
		END

	end

	UPDATE [CFG].[DebitCreditNote]
	SET     [Number] = @Number, 
			[Date] = @Date, 
			[Version] = @Version + 1,
			[LastEditor] = @LastEditor, 
			[LastEditionDate] = @LastEditionDate,
			[BranchID] =@BranchID,
			[Description]=@Description,
			[Description2] =@Description2
	WHERE  [DebitCreditNoteID] = @DebitCreditNoteID
	
	-- Begin Return Select <- do not remove
	SELECT [Version],
		  [Number]
	FROM   [CFG].[DebitCreditNote]
	WHERE  [DebitCreditNoteID] = @DebitCreditNoteID	
	-- End Return Select <- do not remove
END
