CREATE     PROC [FOS].[spClearanceInsert] 
    @FinancialPeriodID int,
    @BranchID int,
    @Number int,
    @Date date,    
	@PartyID bigint,
	@CotajNumber varchar(250),
    @CotajDate date,
	@EntranceCustomsID int,
	@AssessmentCustomsID int,
    @Description nvarchar(256),
    @Description2 nvarchar(256),
    @Creator int,
    @CreationDate datetime	
--WITH ENCRYPTION
AS 
BEGIN 
	SET NOCOUNT ON 

	DECLARE @maxDate DATE
	SELECT @maxDate = MAX(EndDate)
	FROM cfg.Vat v
	
	IF @maxDate IS NOT NULL
		AND @maxDate >= @Date
	BEGIN 	    
		RAISERROR('VatHasPublished', 16, 12)
	END

	if (@Number is null or @Number = 0)
	set @Number = isnull((select max(Number) + 1 from FOS.Clearance where FinancialPeriodID = @FinancialPeriodID),1)

	INSERT INTO [FOS].[Clearance] ([FinancialPeriodID], [BranchID], [Number], [Date], [PartyID],
	 [CotajNumber], [CotajDate], [EntranceCustomsID], [AssessmentCustomsID], [Description], [Description2],
	 [Creator], [CreationDate], [LastEditor], [LastEditionDate], [Version])
	SELECT @FinancialPeriodID, @BranchID, @Number, @Date, @PartyID,
	 @CotajNumber, @CotajDate, @EntranceCustomsID, @AssessmentCustomsID, @Description, @Description2,
	 @Creator, @CreationDate, @Creator, @CreationDate, 0
	
	-- Begin Return Select <- do not remove
	SELECT [ClearanceID] ,[Version], [Number]
	FROM   [FOS].[Clearance]
	WHERE  [ClearanceID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
END
