------------------------------------- START #7188

CREATE   PROCEDURE [CFG].[GetReportGeneratorVariable](@UserName NVARCHAR(200), @NeddValue BIT = 0)
--WITH ENCRYPTION
AS
	DECLARE @FinancialPeriod    VARCHAR(256),
	        @PTitle            VARCHAR(256),
	        @PTitle2           VARCHAR(256),
	        @PStartDate         VARCHAR(256),
	        @PEndDate           VARCHAR(256),
	        @CTitle            NVARCHAR(256),
	        @CTitle2           VARCHAR(256),
	        @CExchangeUnit      VARCHAR(256),
	        @CPrecisionCount    VARCHAR(256),
	        @CPrecisionTitle   NVARCHAR(256),
	        @CPrecisionTitle2  NVARCHAR(256),
	        @BCode              VARCHAR(256),
	        @BTitle            NVARCHAR(256),
	        @BAddress          NVARCHAR(256),
	        @BPhone            NVARCHAR(256),
	        @BFax              NVARCHAR(256),
	        @BSupervisor       NVARCHAR(256),
	        @BIsActive          VARCHAR(256),
	        @BTitle2           VARCHAR(256),
	        @BAddress2         VARCHAR(256),
	        @BSupervisor2      VARCHAR(256)
	
	
	
	IF (@NeddValue = 1)
	BEGIN
	    SELECT @FinancialPeriod = fp.FinancialPeriodID,
	           @PTitle = fp.Title,
	           @PTitle2 = fp.Title2,
	           @PStartDate = fp.StartDate,
	           @PEndDate = fp.EndDate
	    FROM   cfg.FinancialPeriod fp
	    WHERE  fp.FinancialPeriodID = (
	               SELECT us.SettingValue
	               FROM   cfg.UserSetting us
	                      INNER JOIN cfg.[User] u
	                           ON  u.UserID = us.UserID
	               WHERE  us.SettingKey = 'DEFAULT_FININCIAL_PERIOD'
	               and u.Username=@UserName
	           )
	    
	    SELECT @CTitle = c.Title,
	           @CTitle2 = c.Title2,
	           @CExchangeUnit = c.ExchangeUnit,
	           @CPrecisionCount = c.PrecisionCount,
	           @CPrecisionTitle = c.PrecisionTitle,
	           @CPrecisionTitle2 = c.PrecisionTitle2
	    FROM   cfg.Currency c
	    WHERE  c.CurrencyID = -1
	    
	    
	    SELECT @BCode = b.Code,
	           @BTitle = b.Title,
	           @BAddress = b.[Address],
	           @BPhone = b.Phone,
	           @BFax = b.Fax,
	           @BSupervisor = b.Supervisor,
	           @BIsActive = b.IsActive,
	           @BTitle2 = b.Title2,
	           @BAddress2 = b.Address2,
	           @BSupervisor2 = b.Supervisor2
	    FROM   cfg.Branch b
	    WHERE  b.BranchID = -1
	END
	

	SELECT * INTO #T
	FROM   (
	           SELECT c.ConfigKey,
	                  c.ConfigValue
	           FROM   cfg.Configuration c
	           WHERE  id <= 17
	           UNION
	           SELECT 'DEFAULT_FININCIAL_PERIOD',
	                  @FinancialPeriod
	           UNION
	           SELECT 'DEFAULT_FININCIAL_PERIOD_Title',
	                  @PTitle
	           UNION
	           SELECT 'DEFAULT_FININCIAL_PERIOD_StartDate',
	                  cast(@PStartDate AS VARCHAR(50))
	           UNION
	           SELECT 'DEFAULT_FININCIAL_PERIOD_EndDate',
	                  cast(@PEndDate AS VARCHAR(50))
	           
	           ----
	           UNION
	           SELECT 'CTitle',
	                  @CTitle
	           
	           UNION
	           SELECT 'CTitle2',
	                  @CTitle2
	           UNION
	           SELECT 'CExchangeUnit',
	                  @CExchangeUnit
	           UNION
	           SELECT 'CPrecisionCount',
	                  @CPrecisionCount
	           UNION
	           SELECT 'CPrecisionTitle',
	                  @CPrecisionTitle
	           UNION
	           SELECT 'CPrecisionTitle2',
	                  @CPrecisionTitle2
	           
	           --
	           UNION
	           SELECT 'BCode',
	                  @BCode
	           UNION
	           SELECT 'BTitle',
	                  @BTitle
	           UNION
	           SELECT 'BAddress',
	                  @BAddress
	           UNION
	           SELECT 'BPhone',
	                  @BPhone
	           UNION
	           SELECT 'BFax',
	                  @BFax
	           UNION
	           SELECT 'BSupervisor',
	                  @BSupervisor
	           UNION
	           SELECT 'BIsActive',
	                  @BIsActive
	           UNION
	           SELECT 'BTitle2',
	                  @BTitle2
	           UNION
	           SELECT 'BAddress2',
	                  @BAddress2

	           UNION
	           SELECT 'BSupervisor2',
	                  @BSupervisor2
	                  
	                   UNION
	           SELECT 'ShamsiToDay',
	                  cfg.GetSaturnDate(GETDATE(),0)
	       )T
	
	SELECT *	FROM   #t
