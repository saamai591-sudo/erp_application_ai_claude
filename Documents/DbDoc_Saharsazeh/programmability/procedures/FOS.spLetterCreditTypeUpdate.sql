

CREATE PROC [FOS].[spLetterCreditTypeUpdate] 
    @LetterCreditTypeID int,
    @Code nvarchar(250),
    @Title nvarchar(250),
    @Title2 nvarchar(250),
    @Term bit,
    @ProfitSl int,
    @PaymentableProfitSl int,
	@FacilitySl int,
    @Version int,
    @LastEditor int,
    @LastEditionDate datetime
AS 
SET NOCOUNT ON

	if @Version=(Select [Version] from [FOS].[LetterCreditType]
	where [LetterCreditTypeID] = @LetterCreditTypeID)
	begin	

		set @Version = @Version +1 

		UPDATE [FOS].[LetterCreditType]
		SET     [Code] = @Code, 
				[Title] = @Title, 
				[Title2] = @Title2, 
				[Term] = @Term, 
				[ProfitSl] = @ProfitSl, 
				[PaymentableProfitSl] = @PaymentableProfitSl, 
				[FacilitySl] = @FacilitySl,
				[Version] = @Version, 
				[LastEditor] = @LastEditor, 
				[LastEditionDate] = @LastEditionDate
		WHERE  [LetterCreditTypeID] = @LetterCreditTypeID
	
		-- Begin Return Select <- do not remove
		SELECT  [Version]
		FROM   [FOS].[LetterCreditType]
		WHERE  [LetterCreditTypeID] = @LetterCreditTypeID	
		-- End Return Select <- do not remove

	end 
ELSE 
		RAISERROR('Version mismatch...', 16 , 10)
