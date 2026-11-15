CREATE PROC [POS].[spInstallmentAccumulationInsert]
    @Number INT ,
    @Date DATE ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME ,
    @FinancialPeriodID INT
AS
    SET NOCOUNT ON; 

    IF @Number IS NULL
        OR @Number = 0
        SET @Number = ISNULL(( SELECT   MAX(Number) + 1
                               FROM     POS.InstallmentAccumulation
                               WHERE    FinancialPeriodID = @FinancialPeriodID
                             ), 1);
	
    INSERT  INTO [POS].[InstallmentAccumulation]
            ( [Number] ,
              [Date] ,
              [Creator] ,
              [CreationDate] ,
              [LastEditor] ,
              [LastEditionDate] ,
              [Version] ,
              [FinancialPeriodID]
            )
            SELECT  @Number ,
                    @Date ,
                    @Creator ,
                    @CreationDate ,
                    @LastEditor ,
                    @LastEditionDate ,
                    0 ,
                    @FinancialPeriodID;
	
	-- Begin Return Select <- do not remove
    SELECT  [InstallmentAccumulationID] ,
            [Version] ,
            [Number]
    FROM    [POS].[InstallmentAccumulation]
    WHERE   [InstallmentAccumulationID] = SCOPE_IDENTITY();
	-- End Return Select <- do not remove
