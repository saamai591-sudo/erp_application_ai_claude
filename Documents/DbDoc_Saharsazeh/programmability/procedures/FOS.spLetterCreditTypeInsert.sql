
CREATE PROC [FOS].[spLetterCreditTypeInsert] 
    @Code nvarchar(250),
    @Title nvarchar(250),
    @Title2 nvarchar(250),
    @Term bit,
    @ProfitSl int,
    @PaymentableProfitSl int,
	@FacilitySl int,
    @Creator int,
    @CreationDate datetime
AS 
	SET NOCOUNT ON 

	
	INSERT INTO [FOS].[LetterCreditType] ([Code], [Title], [Title2], [Term], [ProfitSl], [PaymentableProfitSl], [FacilitySl], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @Code, @Title, @Title2, @Term, @ProfitSl, @PaymentableProfitSl, @FacilitySl, 0, @Creator, @CreationDate, @Creator, @CreationDate
	
	-- Begin Return Select <- do not remove
	SELECT [LetterCreditTypeID], [Version]
	FROM   [FOS].[LetterCreditType]
	WHERE  [LetterCreditTypeID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
               


