CREATE     PROC [NOC].[spCashFoundingInsert] 
    @SlID int,
    @DLID bigint,
    @Debit decimal(30, 4),
	@Credit decimal(30, 4),
	@CurrencyRate decimal(30, 4),
	@BaseCurrencyDebit decimal(30, 4),
	@BaseCurrencyCredit decimal(30, 4),
	@ToDate date,
	@ReportagePeriodID int,
    @Creator int,
    @CreationDate datetime,
	@Description [nvarchar](max),
	@Description2 [nvarchar](max),
	@Number int
--WITH ENCRYPTION 
AS 
BEGIN 
	SET NOCOUNT ON

	if @Number is null or @Number = 0
	select @Number = isnull(max(Number),0)+1
	from NOC.CashFounding
	

	if exists (select * from noc.ConfirmedReport
	where ReportagePeriodID = @ReportagePeriodID
	and type = 1
	)
		begin
		raiserror('ReportOfThePeriodIsConfirmed',16,12)
		return
	end

	INSERT INTO NOC.CashFounding (SlID, DLID, Debit, Credit, CurrencyRate, 
		BaseCurrencyDebit, BaseCurrencyCredit,ToDate,ReportagePeriodID, [Status],
		Creator, CreationDate, LastEditor, LastEditionDate, [Version],[Description],[Description2],Number)
	SELECT @SlID, @DLID, @Debit, @Credit, @CurrencyRate,
	       @BaseCurrencyDebit,@BaseCurrencyCredit,@ToDate,@ReportagePeriodID, 1,
	       @Creator, @CreationDate, @Creator, @CreationDate, 0,@Description,@Description2,@Number
	
	-- Begin Return Select <- do not remove
	SELECT CashFoundingID,[Version],Number,[Status]
	FROM   NOC.CashFounding
	WHERE  CashFoundingID = SCOPE_IDENTITY()
	-- End Return Select <- do not remove

END
