CREATE     PROC [FOS].[spClearanceUpdate] 
    @ClearanceID int,
    @BranchID int,
    @Date date,
	@PartyID bigint,
	@CotajNumber varchar(250),
    @CotajDate date,
	@EntranceCustomsID int,
	@AssessmentCustomsID int,
    @Description nvarchar(256),
    @Description2 nvarchar(256),
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 

	DECLARE @maxDate DATE
	SELECT @maxDate = MAX(EndDate)
	FROM cfg.Vat v
	
	IF @maxDate IS NOT NULL
		AND @maxDate >= @Date
	BEGIN 	    
		RAISERROR('VatHasPublished', 16, 12)
	END

	if @Version=(Select [Version] from [FOS].[Clearance]
	where [ClearanceID] = @ClearanceID)
	begin	
		set @Version = @Version +1 

		UPDATE [FOS].[Clearance]
		SET     [BranchID] = @BranchID, 
				[Date] = @Date, 
				[PartyID] = @PartyID, 
				[CotajNumber] = @CotajNumber, 
				[CotajDate] = @CotajDate, 
				[EntranceCustomsID] = @EntranceCustomsID, 
				[AssessmentCustomsID] = @AssessmentCustomsID, 
				[Description] = @Description, 
				[Description2] = @Description2, 
				[LastEditor] = @LastEditor, 
				[LastEditionDate] = @LastEditionDate, 
				[Version] = @Version
		WHERE  [ClearanceID] = @ClearanceID
	
		-- Begin Return Select <- do not remove
		SELECT  [Version], [Number]
		FROM   [FOS].[Clearance]
		WHERE  [ClearanceID] = @ClearanceID	
		-- End Return Select <- do not remove
	end 
	ELSE 
		RAISERROR('Version mismatch...', 16 , 10)
