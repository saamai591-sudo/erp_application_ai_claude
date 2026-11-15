CREATE     PROC [NOC].[spCashFoundingUpdate]
    @CashFoundingID int,
    @SlID int,
    @DLID bigint,
    @Debit decimal(30, 4),
	@Credit decimal(30, 4),
	@CurrencyRate decimal(30, 4),
	@BaseCurrencyDebit decimal(30, 4),
	@BaseCurrencyCredit decimal(30, 4),
	@ToDate date,
	@ReportagePeriodID int,
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int,
	@Description [nvarchar](max),
	@Description2 [nvarchar](max),
	@Number int
--WITH ENCRYPTION
AS 
SET NOCOUNT ON

	if ((select [Status] from NOC.CashFounding where CashFoundingID = @CashFoundingID) = 2)
	begin
		raiserror('ConfirmedCashFoundingCannotEditAndDeleted',16,12)
		return
	end

	if exists (select * from noc.ConfirmedReport
	where ReportagePeriodID = @ReportagePeriodID
	and type = 1
	)
		begin
		raiserror('ReportOfThePeriodIsConfirmed',16,12)
		return
	end

	if @Version=(Select [Version] from NOC.CashFounding
	where CashFoundingID = @CashFoundingID)
	begin	
		set @Version = @Version +1 

		UPDATE NOC.CashFounding
		SET    SlID = @SlID, 
			   DLID = @DLID, 
			   Debit = @Debit,
			   Credit = @Credit,
			   CurrencyRate = @CurrencyRate,
			   BaseCurrencyDebit = @BaseCurrencyDebit,
			   BaseCurrencyCredit = @BaseCurrencyCredit,
			   ToDate = @ToDate,
			   ReportagePeriodID = @ReportagePeriodID,
			   LastEditor = @LastEditor, 
			   LastEditionDate = @LastEditionDate, 
			   [Version] = @Version,
			   [Description] = @Description,
			   [Description2] = @Description2,
			   Number = @Number
		WHERE  CashFoundingID = @CashFoundingID
	
		-- Begin Return Select <- do not remove
		SELECT [Version],Number,[Status]
		FROM   NOC.CashFounding
		WHERE  CashFoundingID = @CashFoundingID
		-- End Return Select <- do not remove
	end
	else 
		RAISERROR('Version mismatch...', 16 , 10)
