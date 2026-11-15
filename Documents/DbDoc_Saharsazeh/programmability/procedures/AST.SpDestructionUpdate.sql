
-------------------------------------
CREATE   PROCEDURE [AST].[SpDestructionUpdate] 
    @DestructionID int,
    @Number int,
    @Date date,
    @DestructionReasonID int,
    @Description nvarchar(1024) = NULL,
    @Description2 nvarchar(1024) = NULL,
    @FinancialPeriodID int,
    @PreVoucherID int = NULL,
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime,
	@BranchID int,
	@DestructionStatus tinyint
--WITH ENCRYPTION
AS 
SET NOCOUNT ON 

	if @Version <> (Select [Version] from [AST].[Destruction]
				where [DestructionID] = @DestructionID)
	begin
		RAISERROR('Version mismatch...', 16 , 10)
		return
	end

	set @Version = @Version +1 

		UPDATE [AST].[Destruction]
		SET [Number] = @Number,
			[Date] = @Date, 
			[DestructionReasonID] = @DestructionReasonID, 
			[Description] = @Description, 
			[Description2] = @Description2, 
			[FinancialPeriodID] = @FinancialPeriodID, 
			[PreVoucherID] = @PreVoucherID, 
			[Version] = @Version, 
			[Creator] = @Creator,
			[CreationDate] = @CreationDate, 
			[LastEditor] = @LastEditor, 
			[LastEditionDate] = @LastEditionDate, 
			[BranchID] = @BranchID,
			[DestructionStatus] = @DestructionStatus
		WHERE  [DestructionID] = @DestructionID
	
		-- Begin Return Select <- do not remove
		SELECT	[Version],
				[Number] 
		FROM   [AST].[Destruction]
		WHERE  [DestructionID] = @DestructionID	
		-- End Return Select <- do not remove
