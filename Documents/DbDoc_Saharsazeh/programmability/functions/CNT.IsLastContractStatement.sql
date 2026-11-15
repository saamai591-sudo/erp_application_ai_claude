
CREATE   FUNCTION [CNT].[IsLastContractStatement]
    (
        @ContractStatementID INT
    )
RETURNS BIT
AS
    BEGIN

        DECLARE @IsLast BIT = 0 ,
                @ContractID INT ,
                @ContractSubjectID INT ,
                @ContractStatementTypeID INT ,
                @NumberOfCurrent INT ,
                @NumberOfMax INT;



        SELECT @ContractID = ContractID ,
               @ContractStatementTypeID = ContractStatementTypeID ,
               @NumberOfCurrent = Number
        FROM   CNT.ContractStatement
        WHERE  ContractStatementID = @ContractStatementID;

        SELECT @NumberOfMax = MAX(Number)
        FROM   CNT.ContractStatement
        WHERE  ContractID = @ContractID
               AND ContractStatementTypeID = @ContractStatementTypeID;



        IF @NumberOfCurrent = @NumberOfMax
            SET @IsLast = 1;


        RETURN @IsLast;
    END;
