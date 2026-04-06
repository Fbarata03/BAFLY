import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Legal.css';

const TERMS = (
  <>
    <h1>Termos de Serviço</h1>
    <p className="legal-updated">Última atualização: Abril 2026</p>

    <h2>1. Aceitação dos Termos</h2>
    <p>Ao aceder e utilizar o BAFLY, aceitas os presentes Termos de Serviço na íntegra. Se não concordares com algum dos termos, não deves utilizar esta plataforma.</p>

    <h2>2. Idade Mínima</h2>
    <p>O BAFLY é <strong>exclusivamente para maiores de 18 anos</strong>. Ao utilizares esta plataforma, confirmas que tens 18 ou mais anos de idade. Menores de idade serão banidos permanentemente.</p>

    <h2>3. Regras de Conduta</h2>
    <p>É estritamente proibido:</p>
    <ul>
      <li>Exibir conteúdo sexual explícito sem consentimento</li>
      <li>Assediar, ameaçar ou intimidar outros utilizadores</li>
      <li>Partilhar conteúdo ilegal, incluindo material de abuso infantil</li>
      <li>Usar a plataforma para spam ou fins comerciais não autorizados</li>
      <li>Tentar hackear ou comprometer a segurança da plataforma</li>
    </ul>

    <h2>4. Anonimato e Privacidade</h2>
    <p>O BAFLY foi concebido para conversas anónimas. Não partilhes informações pessoais como nome completo, morada, número de telefone ou dados bancários com desconhecidos.</p>

    <h2>5. Sistema de Reports</h2>
    <p>Encorajamos os utilizadores a reportar comportamentos inadequados. Reports abusivos ou falsos resultarão em suspensão da conta. A equipa de moderação analisará todos os reports e tomará as medidas necessárias.</p>

    <h2>6. Responsabilidade</h2>
    <p>O BAFLY não é responsável pelo conteúdo gerado pelos utilizadores. A plataforma fornece apenas a infraestrutura técnica para ligação entre utilizadores. Cada utilizador é responsável pelo seu próprio comportamento.</p>

    <h2>7. Bans e Suspensões</h2>
    <p>Reservamo-nos o direito de suspender ou banir permanentemente qualquer conta que viole estes termos, sem aviso prévio e sem direito a reembolso.</p>

    <h2>8. Alterações aos Termos</h2>
    <p>Podemos atualizar estes termos a qualquer momento. O uso continuado da plataforma após alterações implica a aceitação dos novos termos.</p>

    <h2>9. Contacto</h2>
    <p>Para questões relacionadas com estes termos, contacta-nos através de: <strong>support@bafly.net</strong></p>
  </>
);

const PRIVACY = (
  <>
    <h1>Política de Privacidade</h1>
    <p className="legal-updated">Última atualização: Abril 2026</p>

    <h2>1. Dados que Recolhemos</h2>
    <p>Ao utilizar o BAFLY, podemos recolher:</p>
    <ul>
      <li><strong>Dados de conta:</strong> nome de utilizador, endereço de email (se fornecido via OAuth)</li>
      <li><strong>Dados de sessão:</strong> duração das chamadas, país de origem (aproximado por IP)</li>
      <li><strong>Dados técnicos:</strong> endereço IP, tipo de navegador, dispositivo</li>
      <li><strong>Mensagens de chat:</strong> guardadas temporariamente durante a sessão</li>
    </ul>

    <h2>2. Como Usamos os Dados</h2>
    <p>Os teus dados são usados para:</p>
    <ul>
      <li>Fazer funcionar o serviço de videochat anónimo</li>
      <li>Moderar conteúdo e aplicar bans</li>
      <li>Melhorar a qualidade do serviço</li>
      <li>Cumprir obrigações legais</li>
    </ul>

    <h2>3. Partilha de Dados</h2>
    <p>Não vendemos nem partilhamos os teus dados pessoais com terceiros para fins comerciais. Podemos partilhar dados com autoridades competentes quando exigido por lei.</p>

    <h2>4. Cookies</h2>
    <p>Usamos cookies essenciais para manter a tua sessão ativa. Não usamos cookies de rastreio ou publicidade.</p>

    <h2>5. Retenção de Dados</h2>
    <p>Os dados de sessão são eliminados após 30 dias. Dados de conta são mantidos enquanto a conta estiver ativa. Podes solicitar a eliminação da tua conta a qualquer momento.</p>

    <h2>6. Os Teus Direitos (RGPD)</h2>
    <p>Tens direito a:</p>
    <ul>
      <li>Aceder aos teus dados pessoais</li>
      <li>Corrigir dados incorretos</li>
      <li>Solicitar a eliminação dos teus dados</li>
      <li>Opor-te ao tratamento dos teus dados</li>
    </ul>

    <h2>7. Segurança</h2>
    <p>Utilizamos ligações encriptadas (HTTPS/WSS) e não armazenamos passwords em texto simples. No entanto, nenhum sistema é 100% seguro — utiliza a plataforma com responsabilidade.</p>

    <h2>8. Menores</h2>
    <p>Não recolhemos intencionalmente dados de menores de 18 anos. Se detetarmos que um utilizador é menor, a conta será eliminada imediatamente.</p>

    <h2>9. Contacto</h2>
    <p>Para exerceres os teus direitos ou questões de privacidade: <strong>privacy@bafly.net</strong></p>
  </>
);

const Legal = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isPrivacy = location.pathname === '/privacidade';

  return (
    <div className="legal-page">
      <header className="legal-header">
        <div className="legal-logo" onClick={() => navigate('/')}>
          <span className="logo-ba">BA</span>
          <span className="logo-fly">FLY</span>
        </div>
        <nav className="legal-nav">
          <span
            className={!isPrivacy ? 'active' : ''}
            onClick={() => navigate('/termos')}
          >
            Termos
          </span>
          <span
            className={isPrivacy ? 'active' : ''}
            onClick={() => navigate('/privacidade')}
          >
            Privacidade
          </span>
        </nav>
      </header>

      <main className="legal-content">
        {isPrivacy ? PRIVACY : TERMS}
      </main>

      <footer className="legal-footer">
        <button onClick={() => navigate(-1)}>← Voltar</button>
        <span>© 2026 BAFLY. Todos os direitos reservados.</span>
      </footer>
    </div>
  );
};

export default Legal;
