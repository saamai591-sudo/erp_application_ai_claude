CREATE     PROC [SLE].[spPourcentageParameterInsert]
    @Code INT ,
    @Title NVARCHAR(500) ,
    @Title2 NVARCHAR(500) ,
    @Type TINYINT ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME 
AS
    SET NOCOUNT ON;

    IF @Code IS NULL
       OR @Code = 0
        BEGIN
            SET @Code = ISNULL((   SELECT MAX(pp.Code)
                                   FROM   SLE.PourcentageParameter AS pp ) ,
                               0) + 1;
        END;

    INSERT INTO [SLE].[PourcentageParameter] ( [Code] ,
                                               [Title] ,
                                               [Title2] ,
                                               [Type] ,
                                               [Creator] ,
                                               [CreationDate] ,
                                               [LastEditor] ,
                                               [LastEditionDate] ,
                                               [Version] )
                SELECT @Code ,
                       @Title ,
                       @Title2 ,
                       @Type ,
                       @Creator ,
                       @CreationDate ,
                       @LastEditor ,
                       @LastEditionDate ,
                       0;

    -- Begin Return Select <- do not remove
    SELECT [PourcentageParameterID] ,
           [Version],
           [Code] 
    FROM   [SLE].[PourcentageParameter]
    WHERE  [PourcentageParameterID] = SCOPE_IDENTITY();
-- End Return Select <- do not remove
